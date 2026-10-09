import { limits } from "./limits.js";
export { limits } from "./limits.js";
import { connectedProducts } from "./connections.js";
import { randomUUID } from "node:crypto";
import {
  rawDb,
  db,
  indexProductVariants,
  getSetting,
  setSetting,
  transaction,
} from "../db.js";
import { inTenant, tenantId } from "../tenant.js";
import { sql, provision, token, audit } from "../platform/core.js";
import { event } from "../platform/onboarding.js";
import { sourceKey, reviewProduct, toVera } from "./contracts.js";
import { parseCsv } from "./csv.js";
import { shopifyPage } from "./shopify.js";
import { safeFetch } from "./safe-fetch.js";
import { saveImportImage, promoteImages } from "../media.js";
rawDb.exec(`CREATE TABLE IF NOT EXISTS platform_import_jobs(id TEXT PRIMARY KEY,owner_id INTEGER NOT NULL,source_type TEXT NOT NULL,source_url TEXT,payload TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'queued',target_store_id INTEGER,cursor INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,lease INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL,updated INTEGER NOT NULL,error TEXT,bytes INTEGER NOT NULL DEFAULT 0,request_key TEXT NOT NULL,UNIQUE(owner_id,request_key));
CREATE TABLE IF NOT EXISTS platform_import_items(id INTEGER PRIMARY KEY,job_id TEXT NOT NULL,source_key TEXT NOT NULL,data TEXT NOT NULL,selected INTEGER NOT NULL DEFAULT 0,state TEXT NOT NULL DEFAULT 'review',issues TEXT NOT NULL,product_id TEXT,UNIQUE(job_id,source_key));
CREATE TABLE IF NOT EXISTS platform_source_mappings(store_id INTEGER NOT NULL,source_key TEXT NOT NULL,product_id TEXT NOT NULL,old_url TEXT,PRIMARY KEY(store_id,source_key));
CREATE TABLE IF NOT EXISTS platform_import_connections(id TEXT PRIMARY KEY,owner_id INTEGER NOT NULL,provider TEXT NOT NULL,domain TEXT NOT NULL,secret TEXT,state TEXT NOT NULL,created INTEGER NOT NULL);`);
if (
  !sql("PRAGMA table_info(platform_import_jobs)")
    .all()
    .some((c) => c.name === "images_downloaded")
)
  rawDb.exec(
    "ALTER TABLE platform_import_jobs ADD COLUMN images_downloaded INTEGER NOT NULL DEFAULT 0",
  );

export function createJob(user, body) {
  const key = String(body.requestKey || "");
  if (!/^[a-z0-9-]{8,80}$/i.test(key)) throw Error("IDEMPOTENCY_KEY_REQUIRED");
  const existing = sql(
    "SELECT * FROM platform_import_jobs WHERE owner_id=? AND request_key=?",
  ).get(user.id, key);
  if (existing) return existing;
  if (
    sql(
      "SELECT id FROM platform_import_jobs WHERE owner_id=? AND state IN ('queued','detecting','scanning','importing')",
    ).get(user.id)
  )
    throw Error("ONE_ACTIVE_JOB_PER_ACCOUNT");
  if (
    ![
      "csv",
      "shopify-csv",
      "woocommerce-csv",
      "shopify-url",
      "shopify-api",
      "woocommerce-api",
    ].includes(body.sourceType) ||
    body.ownsContent !== true
  )
    throw Error("CONFIRM_SOURCE_OWNERSHIP");
  if (body.csv && Buffer.byteLength(body.csv) > limits.fileBytes)
    throw Error("CSV_TOO_LARGE");
  if (
    body.sourceType.endsWith("-api") &&
    !sql(
      "SELECT id FROM platform_import_connections WHERE id=? AND owner_id=? AND provider=? AND state='active'",
    ).get(body.connectionId, user.id, body.sourceType.replace("-api", ""))
  )
    throw Error("AUTHORIZED_CONNECTION_REQUIRED");
  if (body.sourceType === "shopify-url") {
    const url = new URL(body.sourceUrl);
    if (url.username || url.password) throw Error("SOURCE_UNSAFE_URL");
  }
  const id = randomUUID(),
    now = Date.now();
  sql(
    "INSERT INTO platform_import_jobs(id,owner_id,source_type,source_url,payload,created,updated,request_key) VALUES(?,?,?,?,?,?,?,?)",
  ).run(
    id,
    user.id,
    body.sourceType,
    body.sourceUrl || null,
    JSON.stringify({
      csv: body.csv || "",
      connectionId: body.connectionId || null,
      mapping: body.mapping || {},
      currency: body.currency || "",
      locale: body.locale || "en",
    }),
    now,
    now,
    key,
  );
  event(user.id, null, "import_started");
  return sql("SELECT * FROM platform_import_jobs WHERE id=?").get(id);
}
export function jobReport(job) {
  const counts = sql(
    "SELECT state,count(*) n FROM platform_import_items WHERE job_id=? GROUP BY state",
  ).all(job.id);
  return {
    id: job.id,
    sourceType: job.source_type,
    sourceUrl: job.source_url,
    state: job.state,
    targetStoreId: job.target_store_id,
    cursor: job.cursor,
    created: job.created,
    updated: job.updated,
    error: job.error,
    downloadedBytes: job.bytes,
    downloadedImages: job.images_downloaded || 0,
    completeness:
      job.error === "PRODUCT_LIMIT_SOURCE_PARTIAL"
        ? "partial-snapshot"
        : job.source_type === "shopify-url"
          ? "best-effort"
          : job.source_type.endsWith("-api")
            ? "api-snapshot"
            : "file-snapshot",
    counts: Object.fromEntries(counts.map((r) => [r.state, r.n])),
    limits,
  };
}
function saveItems(job, products) {
  const total = sql(
    "SELECT count(*) n FROM platform_import_items WHERE job_id=?",
  ).get(job.id).n;
  const existing = new Set(
    sql("SELECT source_key FROM platform_import_items WHERE job_id=?")
      .all(job.id)
      .map((i) => i.source_key),
  );
  if (
    total + products.filter((p) => !existing.has(sourceKey(p))).length >
    limits.products
  ) {
    products = products
      .filter((p) => !existing.has(sourceKey(p)))
      .slice(0, limits.products - total);
    sql(
      "UPDATE platform_import_jobs SET error='PRODUCT_LIMIT_SOURCE_PARTIAL' WHERE id=?",
    ).run(job.id);
  }
  for (const p of products) {
    const issues = [
      ...reviewProduct(p),
      ...(p.warnings?.filter((w) => w.startsWith("UNSUPPORTED")) || []),
    ];
    sql(
      "INSERT OR IGNORE INTO platform_import_items(job_id,source_key,data,issues) VALUES(?,?,?,?)",
    ).run(job.id, sourceKey(p), JSON.stringify(p), JSON.stringify(issues));
  }
}
export async function runJob(
  job,
  { fetchImage = safeFetch, fetchPage = shopifyPage } = {},
) {
  let lease = Date.now() + 60000;
  const claimed = sql(
    "UPDATE platform_import_jobs SET lease=?,state=CASE WHEN state='queued' THEN 'detecting' ELSE state END WHERE id=? AND lease<? AND state IN ('queued','detecting','scanning','importing')",
  ).run(lease, job.id, Date.now()).changes;
  if (!claimed) return;
  const controller = new AbortController(),
    heartbeat = setInterval(() => {
      try {
        const next = Date.now() + 60000;
        const changed = sql(
          "UPDATE platform_import_jobs SET lease=? WHERE id=? AND lease=? AND state IN ('detecting','scanning','importing')",
        ).run(next, job.id, lease).changes;
        if (!changed) controller.abort();
        else lease = next;
      } catch {
        controller.abort();
      }
    }, 15000);
  heartbeat.unref();
  try {
    if (job.state !== "importing") {
      const payload = JSON.parse(job.payload);
      if (job.source_type.endsWith("csv")) {
        saveItems(
          job,
          parseCsv(payload.csv, { ...payload, sourceType: job.source_type }),
        );
        sql(
          "UPDATE platform_import_jobs SET state='awaiting_review',payload=?,lease=0,updated=? WHERE id=? AND state!='cancelled'",
        ).run(JSON.stringify({ ...payload, csv: "" }), Date.now(), job.id);
      } else {
        const connected = job.source_type.endsWith("-api")
          ? await connectedProducts(
              payload.connectionId,
              job.owner_id,
              job.cursor + 1,
              payload.apiCursor,
              controller.signal,
            )
          : null;
        const products = connected
          ? connected.products
          : await fetchPage(job.source_url, job.cursor + 1, {
              signal: controller.signal,
            });
        for (const p of products) {
          p.locale = payload.locale;
          if (payload.currency && !p.currency) p.currency = payload.currency;
        }
        transaction(() => {
          if (
            sql("SELECT state FROM platform_import_jobs WHERE id=?").get(job.id)
              .state === "cancelled"
          )
            return;
          saveItems(job, products);
          sql(
            "UPDATE platform_import_jobs SET state=?,cursor=cursor+1,lease=0,updated=? WHERE id=?",
          ).run(
            (connected ? !!connected.next : products.length === 100) &&
              job.cursor < limits.pages - 1 &&
              sql(
                "SELECT count(*) n FROM platform_import_items WHERE job_id=?",
              ).get(job.id).n < limits.products
              ? "scanning"
              : "awaiting_review",
            Date.now(),
            job.id,
          );
          if (connected)
            sql("UPDATE platform_import_jobs SET payload=? WHERE id=?").run(
              JSON.stringify({ ...payload, apiCursor: connected.next }),
              job.id,
            );
        });
      }
    } else {
      const item = sql(
        "SELECT * FROM platform_import_items WHERE job_id=? AND selected=1 AND state='review' ORDER BY id LIMIT 1",
      ).get(job.id);
      if (!item) {
        const failed = sql(
          "SELECT count(*) n FROM platform_import_items WHERE job_id=? AND selected=1 AND state='failed'",
        ).get(job.id).n;
        sql(
          "UPDATE platform_import_jobs SET state=?,lease=0,updated=? WHERE id=?",
        ).run(failed ? "partial" : "ready", Date.now(), job.id);
        return;
      }
      const mapped = sql(
        "SELECT product_id FROM platform_source_mappings WHERE store_id=? AND source_key=?",
      ).get(job.target_store_id, item.source_key);
      if (mapped) {
        sql(
          "UPDATE platform_import_items SET state='imported',product_id=? WHERE id=?",
        ).run(mapped.product_id, item.id);
        sql("UPDATE platform_import_jobs SET lease=0,updated=? WHERE id=?").run(
          Date.now(),
          job.id,
        );
        return;
      }
      try {
        const p = JSON.parse(item.data);
        const used = job.images_downloaded || 0;
        if (used + p.images.length > limits.images)
          throw Error("IMAGE_COUNT_BUDGET_EXCEEDED");
        const images = [],
          staged = [];
        let bytes = 0;
        for (const url of p.images) {
          const fetched = await fetchImage(url, {
            signal: controller.signal,
            types: ["image/jpeg", "image/png", "image/webp", "image/avif"],
          });
          bytes += fetched.buffer.length;
          sql(
            "UPDATE platform_import_jobs SET bytes=bytes+?,images_downloaded=images_downloaded+1 WHERE id=?",
          ).run(fetched.buffer.length, job.id);
          if (job.bytes + bytes > limits.imageBytes)
            throw Error("IMAGE_BUDGET_EXCEEDED");
          const image = await saveImportImage(fetched.buffer, job.id);
          images.push(image.url);
          staged.push(image);
        }
        const product = toVera(p, images),
          store = sql("SELECT * FROM platform_stores WHERE id=?").get(
            job.target_store_id,
          );
        if (
          p.currency !==
          inTenant(
            store.id,
            `/s/${store.slug}`,
            () => getSetting("store").checkout.currency,
          )
        )
          throw Error("CURRENCY_REPRICE_REQUIRED");
        if (
          controller.signal.aborted ||
          sql("SELECT lease FROM platform_import_jobs WHERE id=?").get(job.id)
            .lease !== lease ||
          sql("SELECT state FROM platform_import_jobs WHERE id=?").get(job.id)
            .state === "cancelled"
        )
          return;
        await promoteImages(job.id, staged);
        transaction(() => {
          if (
            sql("SELECT state FROM platform_import_jobs WHERE id=?").get(job.id)
              .state === "cancelled"
          )
            return;
          inTenant(store.id, `/s/${store.slug}`, () => {
            if (
              !sql(
                "SELECT product_id FROM platform_source_mappings WHERE store_id=? AND source_key=?",
              ).get(store.id, item.source_key)
            ) {
              db.prepare(
                "INSERT INTO products(id,data,position) VALUES(?,?,(SELECT coalesce(max(position),-1)+1 FROM products))",
              ).run(product.id, JSON.stringify(product));
              indexProductVariants(product);
              sql(
                "INSERT INTO platform_source_mappings(store_id,source_key,product_id,old_url) VALUES(?,?,?,?)",
              ).run(store.id, item.source_key, product.id, p.sourceUrl || null);
            }
          });
          sql(
            "UPDATE platform_import_items SET state='imported',product_id=? WHERE id=?",
          ).run(product.id, item.id);
        });
      } catch (e) {
        if (e.retryable) throw e;
        sql(
          "UPDATE platform_import_items SET state='failed',issues=? WHERE id=?",
        ).run(JSON.stringify([String(e.message).slice(0, 180)]), item.id);
      }
      sql("UPDATE platform_import_jobs SET lease=0,updated=? WHERE id=?").run(
        Date.now(),
        job.id,
      );
    }
  } catch (e) {
    if (e.retryable && job.attempts < 3) {
      sql(
        "UPDATE platform_import_jobs SET attempts=attempts+1,lease=?,error=?,updated=? WHERE id=? AND state!='cancelled'",
      ).run(
        Date.now() + Math.max(e.retryAfter || 0, 5000 * 2 ** job.attempts),
        e.message,
        Date.now(),
        job.id,
      );
      return;
    }
    sql(
      "UPDATE platform_import_jobs SET state=?,error=?,lease=0,updated=? WHERE id=? AND state!=?",
    ).run(
      "failed",
      String(e.message).slice(0, 180),
      Date.now(),
      job.id,
      "cancelled",
    );
  } finally {
    clearInterval(heartbeat);
  }
}
export function commitJob(job, user, body) {
  if (job.target_store_id) {
    if (["awaiting_review", "partial"].includes(job.state))
      sql("UPDATE platform_import_jobs SET state='importing' WHERE id=?").run(
        job.id,
      );
    return job.target_store_id;
  }
  if (job.state !== "awaiting_review") throw Error("REVIEW_REQUIRED");
  const items = sql(
    "SELECT * FROM platform_import_items WHERE job_id=? AND selected=1",
  ).all(job.id);
  if (!items.length) throw Error("SELECT_PRODUCTS");
  if (items.some((i) => JSON.parse(i.issues).length))
    throw Error("RESOLVE_SELECTED_ITEMS");
  if (items.some((i) => JSON.parse(i.data).currency !== body.currency))
    throw Error("TARGET_CURRENCY_MUST_MATCH_REVIEWED_PRODUCTS");
  const store = provision(
    user,
    {
      name: body.name,
      slug: body.slug,
      template: body.template,
      password: token(),
    },
    () => {
      const id = tenantId(),
        settings = getSetting("store");
      settings.checkout.currency = body.currency;
      settings.checkout.symbol = body.currency;
      setSetting("store", settings);
      sql(
        "UPDATE platform_import_jobs SET target_store_id=?,state='importing',updated=? WHERE id=?",
      ).run(id, Date.now(), job.id);
    },
  );
  event(user.id, store.id, "import_reviewed");
  audit(user.id, "import.committed", store.id, job.id);
  return store.id;
}
let busy = false;
export function startImportWorker() {
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const jobs = sql(
        "SELECT * FROM platform_import_jobs WHERE state IN ('queued','detecting','scanning','importing') AND lease<? ORDER BY updated LIMIT 2",
      ).all(Date.now());
      await Promise.all(jobs.map((job) => runJob(job)));
    } catch {
      console.error(
        "Import worker iteration failed; durable jobs remain for retry",
      );
    } finally {
      busy = false;
    }
  }, 1000);
  timer.unref();
  return () => clearInterval(timer);
}
