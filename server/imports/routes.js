import { features } from "../platform/features.js";
import sharp from "sharp";
import { safeFetch } from "./safe-fetch.js";
import { sql } from "../platform/core.js";
import { requireUser } from "../platform/auth.js";
import { createJob, jobReport, commitJob } from "./jobs.js";
import { reviewProduct, supportedCurrencies } from "./contracts.js";
import { csvHeaders, aliases } from "./csv.js";
import { limits } from "./limits.js";
const imagePreviews = new Map(),
  previewUsers = new Map();
let activePreviews = 0;
export function registerImports(app, rate) {
  const owned = (req, res, next) => {
    req.job = sql(
      "SELECT * FROM platform_import_jobs WHERE id=? AND owner_id=?",
    ).get(req.params.jobId, req.user.id);
    if (!req.job) return res.status(404).json({ error: "Import not found." });
    next();
  };
  app.get("/api/platform/import-jobs", requireUser, (req, res) =>
    res.json({
      jobs: sql(
        "SELECT * FROM platform_import_jobs WHERE owner_id=?" +
          (req.query.storeId ? " AND target_store_id=?" : "") +
          " ORDER BY created DESC LIMIT 50",
      )
        .all(
          req.user.id,
          ...(req.query.storeId ? [Number(req.query.storeId)] : []),
        )
        .map(jobReport),
    }),
  );
  app.post("/api/platform/import-jobs", requireUser, rate, (req, res) => {
    try {
      const flag = req.body.sourceType?.endsWith("csv")
        ? "importCsv"
        : req.body.sourceType === "shopify-url"
          ? "importUrl"
          : "providerConnectors";
      if (!features()[flag])
        return res
          .status(503)
          .json({ error: "FEATURE_TEMPORARILY_UNAVAILABLE" });
      res.status(201).json(jobReport(createJob(req.user, req.body)));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/platform/import-csv/headers", requireUser, (req, res) => {
    try {
      res.json({ headers: csvHeaders(req.body.csv || ""), aliases });
    } catch {
      res.status(400).json({ error: "CSV_PARSE_ERROR" });
    }
  });
  app.get("/api/platform/import-jobs/:jobId", requireUser, owned, (req, res) =>
    res.json(jobReport(req.job)),
  );
  app.get(
    "/api/platform/import-jobs/:jobId/items",
    requireUser,
    owned,
    (req, res) => {
      const page = Math.max(0, Math.floor(Number(req.query.page) || 0));
      res.json({
        items: sql(
          "SELECT * FROM platform_import_items WHERE job_id=? ORDER BY id LIMIT 25 OFFSET ?",
        )
          .all(req.job.id, page * 25)
          .map((i) => ({
            ...i,
            data: JSON.parse(i.data),
            issues: JSON.parse(i.issues),
          })),
        total: sql(
          "SELECT count(*) n FROM platform_import_items WHERE job_id=?",
        ).get(req.job.id).n,
        page,
      });
    },
  );
  app.get(
    "/api/platform/import-jobs/:jobId/images/:itemId/:imageIndex",
    requireUser,
    owned,
    async (req, res) => {
      const item = sql(
        "SELECT data FROM platform_import_items WHERE id=? AND job_id=?",
      ).get(Number(req.params.itemId), req.job.id);
      if (!item) return res.sendStatus(404);
      const url = JSON.parse(item.data).images[Number(req.params.imageIndex)];
      if (!url) return res.sendStatus(404);
      const key = req.user.id + ":" + url,
        cached = imagePreviews.get(key);
      if (cached && cached.expires > Date.now())
        return res
          .type("image/webp")
          .set("Cache-Control", "private,max-age=60")
          .send(cached.image);
      if (activePreviews >= 4 || (previewUsers.get(req.user.id) || 0) >= 2)
        return res
          .set("Retry-After", "2")
          .status(429)
          .json({ error: "IMAGE_PREVIEW_BUSY" });
      activePreviews++;
      previewUsers.set(req.user.id, (previewUsers.get(req.user.id) || 0) + 1);
      const controller = new AbortController();
      res.once("close", () => {
        if (!res.writableFinished) controller.abort();
      });
      try {
        const source = await safeFetch(url, {
          maxBytes: limits.fileBytes,
          signal: controller.signal,
          types: ["image/jpeg", "image/png", "image/webp", "image/avif"],
        });
        const image = await sharp(source.buffer, { limitInputPixels: 40000000 })
          .rotate()
          .resize(320, 320, { fit: "inside", withoutEnlargement: true })
          .webp()
          .toBuffer();
        if (imagePreviews.size >= 100)
          imagePreviews.delete(imagePreviews.keys().next().value);
        imagePreviews.set(key, { image, expires: Date.now() + 60000 });
        res
          .type("image/webp")
          .set("Cache-Control", "private,max-age=60")
          .send(image);
      } catch {
        if (!controller.signal.aborted)
          res.status(422).json({ error: "IMAGE_PREVIEW_UNAVAILABLE" });
      } finally {
        activePreviews--;
        const remaining = (previewUsers.get(req.user.id) || 1) - 1;
        if (remaining) previewUsers.set(req.user.id, remaining);
        else previewUsers.delete(req.user.id);
      }
    },
  );
  app.patch(
    "/api/platform/import-jobs/:jobId/selection",
    requireUser,
    owned,
    (req, res) => {
      if (!["awaiting_review", "partial"].includes(req.job.state))
        return res
          .status(409)
          .json({ error: "Review is locked while running." });
      const item = sql(
        "SELECT * FROM platform_import_items WHERE id=? AND job_id=? AND state!='imported'",
      ).get(Number(req.body.itemId), req.job.id);
      if (!item) return res.status(404).json({ error: "Item not found." });
      const p = JSON.parse(item.data);
      if (supportedCurrencies.includes(req.body.currency))
        p.currency = req.body.currency;
      if (req.body.stock !== undefined) {
        if (
          !Number.isSafeInteger(req.body.stock) ||
          req.body.stock < 0 ||
          req.body.stock > 1000000
        )
          return res
            .status(400)
            .json({ error: "Enter confirmed non-negative stock." });
        for (const v of p.variants) {
          v.stockKnown = true;
          v.stock = req.body.stock;
          v.unlimited = false;
        }
      }
      if (req.body.unlimited === true) {
        for (const v of p.variants) {
          v.stockKnown = true;
          v.unlimited = true;
          v.stock = null;
        }
      }
      for (const [key, max] of [
        ["title", 90],
        ["description", 12000],
        ["category", 40],
      ])
        if (req.body[key] !== undefined) {
          if (typeof req.body[key] !== "string" || req.body[key].length > max)
            return res.status(400).json({ error: "INVALID_PRODUCT_REVIEW" });
          p[key] = req.body[key];
        }
      if (req.body.images !== undefined) {
        if (
          !Array.isArray(req.body.images) ||
          req.body.images.length > 12 ||
          req.body.images.some((u) => typeof u !== "string" || u.length > 2048)
        )
          return res.status(400).json({ error: "INVALID_IMAGE_REVIEW" });
        p.images = req.body.images;
      }
      if (req.body.variants !== undefined) {
        if (
          !Array.isArray(req.body.variants) ||
          req.body.variants.length !== p.variants.length ||
          req.body.variants.some(
            (v, i) => v.externalId !== p.variants[i].externalId,
          )
        )
          return res
            .status(400)
            .json({ error: "VARIANT_IDENTITIES_MUST_BE_PRESERVED" });
        p.variants = p.variants.map((v, i) => {
          const r = req.body.variants[i];
          return {
            ...v,
            priceMinor: r.priceMinor,
            sku: typeof r.sku === "string" ? r.sku.slice(0, 100) : v.sku,
            stockKnown: r.stockKnown === true,
            stock: r.stock,
            unlimited: r.unlimited === true,
          };
        });
      }
      if (req.body.priceCurrencyReviewed === true)
        p.priceCurrencyReviewed = true;
      const issues = [
        ...reviewProduct(p),
        ...(p.warnings?.filter((w) => w.startsWith("UNSUPPORTED")) || []),
      ];
      sql(
        "UPDATE platform_import_items SET selected=?,data=?,issues=? WHERE id=?",
      ).run(
        req.body.selected === true ? 1 : 0,
        JSON.stringify(p),
        JSON.stringify(issues),
        item.id,
      );
      res.json({ ok: true, issues });
    },
  );
  app.post(
    "/api/platform/import-jobs/:jobId/commit",
    requireUser,
    rate,
    owned,
    (req, res) => {
      try {
        if (!supportedCurrencies.includes(req.body.currency))
          throw Error("TARGET_CURRENCY_REQUIRED");
        const storeId = commitJob(req.job, req.user, req.body);
        res.json({ storeId });
      } catch (e) {
        res.status(400).json({ error: e.message });
      }
    },
  );
  app.post(
    "/api/platform/import-jobs/:jobId/cancel",
    requireUser,
    owned,
    (req, res) => {
      if (!["ready", "cancelled"].includes(req.job.state))
        sql(
          "UPDATE platform_import_jobs SET state='cancelled',updated=? WHERE id=?",
        ).run(Date.now(), req.job.id);
      res.json(
        jobReport(
          sql("SELECT * FROM platform_import_jobs WHERE id=?").get(req.job.id),
        ),
      );
    },
  );
  app.post(
    "/api/platform/import-jobs/:jobId/retry",
    requireUser,
    rate,
    owned,
    (req, res) => {
      if (!["partial", "failed"].includes(req.job.state))
        return res
          .status(409)
          .json({ error: "Retry is available after a failure." });
      sql(
        "UPDATE platform_import_items SET state='review' WHERE job_id=? AND state='failed'",
      ).run(req.job.id);
      sql(
        "UPDATE platform_import_jobs SET state=?,error=NULL,lease=0,attempts=0 WHERE id=?",
      ).run(req.job.target_store_id ? "importing" : "queued", req.job.id);
      res.json({ ok: true });
    },
  );
  app.get(
    "/api/platform/import-jobs/:jobId/report",
    requireUser,
    owned,
    (req, res) => {
      const items = sql(
        "SELECT source_key,data,issues,state,product_id FROM platform_import_items WHERE job_id=?",
      )
        .all(req.job.id)
        .map((i) => ({
          ...i,
          data: JSON.parse(i.data),
          issues: JSON.parse(i.issues),
        }));
      res
        .set(
          "Content-Disposition",
          'attachment; filename="vera-import-report.json"',
        )
        .json({
          ...jobReport(req.job),
          items,
          retention: { stagingDays: 7, reportsDays: 30 },
        });
    },
  );
}
