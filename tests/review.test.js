import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
import { catalogue } from "../src/data/products.js";
import { defaultSettings } from "../src/data/settings.js";
import {
  localizeSettings,
  localizeProduct,
  updateProductContent,
  updateStoreContent,
  updateVariantContent,
} from "../src/i18n/content.js";
import { translate } from "../src/i18n/translations.js";
const directory = mkdtempSync(path.join(os.tmpdir(), "boutique-review-"));
process.env.DATA_DIR = directory;
process.env.NODE_ENV = "test";
delete process.env.ADMIN_PASSWORD;
let db, server, base, cookie, telegram;
const originalFetch = globalThis.fetch;
const customer = {
  name: "عميل الاختبار",
  phone: "+966 555 111 222",
  address: "شارع الحرفيين، المبنى ٣",
  city: "الرياض",
  country: "السعودية",
};
async function request(route, method = "GET", body) {
  const response = await originalFetch(base + "/api" + route, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: response.status === 204 ? null : await response.json(),
    headers: response.headers,
  };
}
const order = (extra = {}) => ({
  idempotency_key: randomUUID(),
  payment_method: "cod",
  customer,
  items: [{ variant_id: "alpaca-beanie-oat", quantity: 1 }],
  ...extra,
});
before(async () => {
  const { app } = await import("../server/index.js");
  ({ db } = await import("../server/db.js"));
  telegram = await import("../server/telegram.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const login = await request("/admin/login", "POST", {
    password: "admin@admin",
  });
  cookie = login.headers.get("set-cookie").split(";")[0];
});
after(async () => {
  globalThis.fetch = originalFetch;
  await telegram.deliverPending();
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(directory, { recursive: true, force: true });
});
test("additive migrations preserve existing custom English content and order snapshots", () => {
  const oldDir = mkdtempSync(path.join(os.tmpdir(), "boutique-legacy-"));
  try {
    const old = new DatabaseSync(path.join(oldDir, "store.sqlite"));
    old.exec(
      "CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);CREATE TABLE products(id TEXT PRIMARY KEY,data TEXT NOT NULL,position INTEGER NOT NULL DEFAULT 0);",
    );
    const settings = structuredClone(defaultSettings);
    delete settings.translations;
    settings.name = "Existing Customer Store";
    old
      .prepare("INSERT INTO settings VALUES (?,?)")
      .run("store", JSON.stringify(settings));
    old.prepare("INSERT INTO settings VALUES (?,?)").run("seeded", "true");
    const product = structuredClone(catalogue[0]);
    product.title = "Existing Custom Scarf";
    old
      .prepare("INSERT INTO products VALUES (?,?,?)")
      .run(product.id, JSON.stringify(product), 0);
    old.close();
    const script =
      "import {db,productsAll,getSetting} from './server/db.js';console.log(JSON.stringify({store:getSetting('store'),products:productsAll(),indexes:db.prepare('SELECT * FROM variant_lookup').all()}));db.close();";
    const result = JSON.parse(
      execFileSync(process.execPath, ["--input-type=module", "-e", script], {
        env: { ...process.env, DATA_DIR: oldDir },
        encoding: "utf8",
      }),
    );
    assert.equal(result.store.name, settings.name);
    assert.equal(result.store.translations.ar.name, undefined);
    assert.equal(result.products[0].title, product.title);
    assert.equal(result.products[0].translations.ar.title, undefined);
    assert.equal(result.indexes.length, product.variants.length);
  } finally {
    rmSync(oldDir, { recursive: true, force: true });
  }
});
test("stale editors cannot restore sold inventory; checkout touches only ordered products", async () => {
  const all = (await request("/admin/products")).body.products;
  const before = all.find((p) => p.id === "alpaca-beanie");
  const result = await request("/orders", "POST", order());
  assert.equal(result.status, 201);
  const after = (await request("/admin/products")).body.products;
  for (const product of all) {
    const next = after.find((p) => p.id === product.id);
    assert.equal(
      next._version,
      product._version + (product.id === "alpaca-beanie" ? 1 : 0),
    );
  }
  const stale = await request("/admin/products/alpaca-beanie", "PUT", before);
  assert.equal(stale.status, 409);
  assert.equal(
    after.find((p) => p.id === "alpaca-beanie").variants[0].inventory_quantity,
    before.variants[0].inventory_quantity - 1,
  );
  const query = db
    .prepare(
      "EXPLAIN QUERY PLAN SELECT p.data FROM variant_lookup v JOIN products p ON p.id=v.product_id WHERE v.id=?",
    )
    .all("alpaca-beanie-oat");
  assert.equal(query.filter((q) => /SEARCH/.test(q.detail)).length, 2);
});
test("settings version conflicts are explicit; changing text does not rewrite catalogue", async () => {
  const settings = (await request("/admin/store")).body;
  const versions = (await request("/admin/products")).body.products.map(
    (p) => p._version,
  );
  let changed = updateStoreContent(
    settings,
    "ar",
    "hero",
    "title",
    "فخامة تنسجها الحكايات",
  );
  const result = await request("/admin/store", "PUT", changed);
  assert.equal(result.status, 200);
  assert.equal((await request("/admin/store", "PUT", settings)).status, 409);
  assert.deepEqual(
    (await request("/admin/products")).body.products.map((p) => p._version),
    versions,
  );
  const publicStore = (await request("/store")).body;
  assert.equal(publicStore.hero.title, settings.hero.title);
  assert.equal(
    localizeSettings(publicStore, "ar").hero.title,
    "فخامة تنسجها الحكايات",
  );
});
test("Arabic product text, styles and details remain independent from English; HTML is sanitized", async () => {
  const baseProduct = (await request("/admin/products")).body.products[0];
  let updated = updateProductContent(
    baseProduct,
    "ar",
    "title",
    "وشاح فاخر للاختبار",
  );
  updated = updateVariantContent(updated, "ar", 0, "title", "لون عاجي");
  updated = updateProductContent(
    updated,
    "ar",
    "description",
    "<p>نعومة <strong>طبيعية</strong></p><script>bad()</script>",
  );
  updated = updateProductContent(updated, "ar", "additional_info", [
    { title: "الخامة العربية", description: "صوف فاخر" },
  ]);
  const result = await request("/admin/products/" + updated.id, "PUT", updated);
  assert.equal(result.status, 200);
  assert.equal(result.body.title, baseProduct.title);
  assert.equal(result.body.variants[0].title, baseProduct.variants[0].title);
  assert.equal(
    result.body.additional_info[0].title,
    baseProduct.additional_info[0].title,
  );
  assert.equal(
    result.body.translations.ar.description,
    "<p>نعومة <strong>طبيعية</strong></p>",
  );
  assert.equal(
    localizeProduct(result.body, "ar").variants[0].title,
    "لون عاجي",
  );
  const empty = { ...baseProduct, title: "", additional_info: [] };
  const created = updateProductContent(
    updateProductContent(empty, "ar", "title", "منتج جديد"),
    "ar",
    "additional_info",
    [{ title: "الخامة", description: "صوف" }],
  );
  assert.equal(created.title, "منتج جديد");
  assert.equal(created.additional_info[0].title, "الخامة");
});
test("Arabic checkout snapshots localized copy and server-backed analytics conversion; heartbeats do not grow events", async () => {
  const session = randomUUID(),
    visitor = randomUUID(),
    at = Date.now() - 1000,
    eventId = randomUUID();
  const payload = {
    session,
    visitor,
    duration: 7000,
    events: [
      { id: eventId, at, type: "page_view", path: "/checkout" },
      {
        id: randomUUID(),
        at: at + 1,
        type: "checkout_start",
        path: "/checkout",
      },
    ],
  };
  assert.equal((await request("/analytics", "POST", payload)).status, 204);
  await request("/analytics", "POST", payload);
  const count = db
    .prepare("SELECT COUNT(*) count FROM events WHERE session=?")
    .get(session).count;
  assert.equal(count, 2);
  await request("/analytics", "POST", {
    ...payload,
    events: [
      {
        id: randomUUID(),
        at: Date.now(),
        type: "heartbeat",
        path: "/checkout",
      },
    ],
  });
  assert.equal(
    db.prepare("SELECT COUNT(*) count FROM events WHERE session=?").get(session)
      .count,
    count,
  );
  await request("/analytics", "POST", {
    ...payload,
    events: [
      { id: randomUUID(), at: at - 500, type: "page_exit", path: "/old-page" },
    ],
  });
  assert.equal(
    db.prepare("SELECT exit FROM visits WHERE id=?").get(session).exit,
    "/checkout",
  );
  const result = await request(
    "/orders",
    "POST",
    order({ language: "ar", analytics: { session, visitor } }),
  );
  assert.equal(result.status, 201);
  assert.equal(result.body.order.language, "ar");
  assert.match(result.body.order.items[0].title, /قبعة/);
  const report = (await request("/admin/analytics")).body;
  assert.equal(report.funnel.at(-1).count, 1);
  assert.equal(report.conversion, 100);
});
test("malformed input, disguised uploads, unsafe redirects and arbitrary SVG programs are rejected", async () => {
  assert.equal((await request("/orders", "POST", null)).status, 400);
  assert.equal(
    (await request("/quantities", "POST", { product_ids: "broken" })).status,
    400,
  );
  const settings = (await request("/admin/store")).body;
  settings.footer.socials = [{ label: "Bad", path: "/\\evil.example" }];
  assert.equal((await request("/admin/store", "PUT", settings)).status, 400);
  const product = (await request("/admin/products")).body.products[0];
  product.images = [
    { url: "data:image/svg+xml;utf8,<svg><script>bad()</script></svg>" },
  ];
  assert.equal(
    (await request("/admin/products/" + product.id, "PUT", product)).status,
    400,
  );
  const form = new FormData();
  form.set(
    "image",
    new Blob(["not an image"], { type: "image/png" }),
    "fake.png",
  );
  const response = await originalFetch(base + "/api/admin/upload", {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  assert.equal(response.status, 400);
});
test("Arabic error messages and dynamic validation guidance translate without changing English", () => {
  assert.equal(
    translate("Incorrect password.", "ar"),
    "كلمة المرور غير صحيحة.",
  );
  assert.equal(
    translate("phone is required and must be at most 60 characters.", "ar"),
    "حقل الهاتف مطلوب ويجب ألا يتجاوز 60 حرفاً.",
  );
  assert.equal(translate("Edit My Product", "ar"), "تعديل My Product");
  assert.equal(translate("Edit My Product", "en"), "Edit My Product");
});
test("Telegram uses one Arabic photo receipt, persists message ID and recovers expired delivery leases", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://api.telegram.org/")) {
      calls.push({ url, form: options.body });
      return new Response(
        JSON.stringify({ ok: true, result: { message_id: 81 } }),
      );
    }
    return originalFetch(url, options);
  };
  await request("/admin/telegram", "PUT", {
    token: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
    chatId: "123456789",
  });
  await telegram.deliverPending();
  calls.length = 0;
  const result = await request(
    "/orders",
    "POST",
    order({
      language: "ar",
      customer: {
        ...customer,
        notes: "ملاحظات كاملة للتوصيل إلى الباب. ".repeat(25),
      },
    }),
  );
  assert.equal(result.status, 201);
  await telegram.deliverPending();
  assert.equal(calls.length, 1);
  assert.ok(String(calls[0].url).endsWith("/sendPhoto"));
  assert.match(
    calls[0].form.get("caption"),
    new RegExp(result.body.order.number),
  );
  const photo = Buffer.from(await calls[0].form.get("photo").arrayBuffer());
  const metadata = await sharp(photo).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.ok(metadata.height > metadata.width);
  const row = db
    .prepare("SELECT * FROM orders WHERE id=?")
    .get(result.body.order.id);
  assert.equal(row.telegram_message_id, 81);
  assert.ok(row.telegram_sent_at);
  db.prepare(
    "UPDATE orders SET telegram_status='sending',telegram_lease_until=0 WHERE id=?",
  ).run(row.id);
  calls.length = 0;
  await telegram.deliverPending();
  assert.equal(calls.length, 1);
  assert.equal(
    db.prepare("SELECT telegram_status FROM orders WHERE id=?").get(row.id)
      .telegram_status,
    "sent",
  );
});
test("Telegram 429 pauses delivery for the requested interval; manual retry cannot duplicate in-flight delivery", async () => {
  globalThis.fetch = async (url, options) =>
    String(url).startsWith("https://api.telegram.org/")
      ? new Response(
          JSON.stringify({
            ok: false,
            error_code: 429,
            description: "Retry later",
            parameters: { retry_after: 61 },
          }),
          { status: 429 },
        )
      : originalFetch(url, options);
  const result = await request("/orders", "POST", order());
  assert.equal(result.status, 201);
  await telegram.deliverPending();
  const row = db
    .prepare("SELECT * FROM orders WHERE id=?")
    .get(result.body.order.id);
  assert.equal(row.telegram_status, "failed");
  assert.ok(row.telegram_next_attempt > Date.now() + 59000);
  db.prepare(
    "UPDATE orders SET telegram_status='sending',telegram_lease_until=? WHERE id=?",
  ).run(Date.now() + 60000, row.id);
  assert.equal(
    (await request("/admin/orders/" + row.id + "/telegram", "POST")).status,
    409,
  );
  db.prepare(
    "UPDATE orders SET telegram_status='failed',telegram_lease_until=0 WHERE id=?",
  ).run(row.id);
  db.prepare("DELETE FROM settings WHERE key='telegram_rate_until'").run();
});
test("permanent Telegram credential failures stop retries; correcting settings re-enables delivery", async () => {
  globalThis.fetch = async (url, options) =>
    String(url).startsWith("https://api.telegram.org/")
      ? new Response(
          JSON.stringify({
            ok: false,
            error_code: 403,
            description: "Forbidden",
          }),
          { status: 403 },
        )
      : originalFetch(url, options);
  const result = await request("/orders", "POST", order());
  await telegram.deliverPending();
  assert.equal(
    db
      .prepare("SELECT telegram_attempts FROM orders WHERE id=?")
      .get(result.body.order.id).telegram_attempts,
    8,
  );
  globalThis.fetch = async (url, options) =>
    String(url).startsWith("https://api.telegram.org/")
      ? new Response(JSON.stringify({ ok: true, result: { message_id: 82 } }))
      : originalFetch(url, options);
  await request("/admin/telegram", "PUT", { chatId: "123456789" });
  await telegram.deliverPending();
  assert.equal(
    db
      .prepare("SELECT telegram_status FROM orders WHERE id=?")
      .get(result.body.order.id).telegram_status,
    "sent",
  );
});
test("changing Arabic variant structure preserves English names and Arabic text can be cleared before retyping", () => {
  const p = structuredClone(catalogue[0]);
  p.translations = {
    ar: {
      variants: p.variants.map((v, i) => ({ id: v.id, title: "خيار " + i })),
    },
  };
  const display = localizeProduct(p, "ar");
  const changed = updateProductContent(p, "ar", "variants", [
    ...display.variants,
    { ...p.variants[0], id: "new-style", title: "Default" },
  ]);
  assert.equal(changed.variants[0].title, p.variants[0].title);
  assert.equal(
    localizeProduct(changed, "ar").variants.at(-1).title,
    "الافتراضي",
  );
  const cleared = updateVariantContent(changed, "ar", 0, "title", "");
  assert.equal(localizeProduct(cleared, "ar").variants[0].title, "");
  let fresh = { ...p, title: "", translations: {} };
  fresh = updateProductContent(fresh, "ar", "title", "م");
  fresh = updateProductContent(fresh, "ar", "title", "منتج كامل");
  assert.equal(fresh.title, "منتج كامل");
});
test("paginated catalogue and dashboard find products beyond the first page without loading all rows", async () => {
  const { transaction, indexProductVariants } = await import("../server/db.js");
  transaction(() => {
    for (let i = 0; i < 28; i++) {
      const p = {
        ...catalogue[0],
        id: "paged-" + i,
        title: "Paged " + i,
        variants: [
          { ...catalogue[0].variants[0], id: "paged-" + i + "-style" },
        ],
      };
      db.prepare("INSERT INTO products(id,data,position) VALUES (?,?,?)").run(
        p.id,
        JSON.stringify(p),
        100 + i,
      );
      indexProductVariants(p);
    }
  });
  const first = (await request("/products")).body;
  assert.equal(first.products.length, 24);
  assert.equal(first.total, 32);
  assert.equal(first.hasMore, true);
  const second = (await request("/products?offset=24")).body;
  assert.equal(second.products.length, 8);
  assert.equal(second.hasMore, false);
  const cart = (await request("/products?ids=paged-27,alpaca-scarf")).body;
  assert.equal(cart.products.length, 2);
  assert.equal(cart.products[0].id, "paged-27");
  const filtered = (await request("/admin/products?page=1&search=paged-27"))
    .body;
  assert.equal(filtered.total, 1);
  assert.equal(filtered.products[0].id, "paged-27");
  assert.equal(
    (await request("/admin/products/paged-27/move", "POST", { direction: -1 }))
      .status,
    200,
  );
  const last = (await request("/admin/products?page=2")).body.products;
  assert.equal(last.at(-1).id, "paged-26");
});
test("analytics pages every visit and long timeline, including archived visits in all-time reports", async () => {
  const { transaction } = await import("../server/db.js");
  transaction(() => {
    for (let i = 0; i < 42; i++)
      db.prepare(
        "INSERT INTO visits(id,visitor,started_at,last_at,entry,exit) VALUES (?,?,?,?,?,?)",
      ).run(
        "test-paged-visit-" + i,
        "test-paged-visitor-" + i,
        Date.now(),
        Date.now(),
        "/",
        "/",
      );
    const session = "test-paged-visit-0";
    for (let i = 0; i < 205; i++)
      db.prepare(
        "INSERT INTO events(event_id,session,at,type,path) VALUES (?,?,?,?,?)",
      ).run("test-paged-event-" + i, session, Date.now() + i, "click", "/");
    db.prepare(
      "INSERT INTO visits(id,visitor,started_at,last_at,entry,exit) VALUES (?,?,?,?,?,?)",
    ).run("test-archived-visit", "test-archived-visitor", 1, 2, "/old", "/old");
  });
  const { invalidateAnalytics } = await import("../server/analytics.js");
  invalidateAnalytics();
  const first = (await request("/admin/analytics?days=30&page=1")).body;
  const second = (await request("/admin/analytics?days=30&page=2")).body;
  assert.equal(first.recent.length, 40);
  assert.ok(second.recent.length > 0);
  assert.equal(first.journeyPages, 2);
  assert.equal(
    new Set([...first.recent, ...second.recent].map((v) => v.id)).size,
    first.sessions,
  );
  const archived = (await request("/admin/analytics?days=0")).body;
  assert.equal(archived.sessions, first.sessions + 1);
  const timeline = (
    await request("/admin/analytics/visits/test-paged-visit-0?page=3")
  ).body;
  assert.equal(timeline.events.length, 5);
  assert.equal(timeline.total, 205);
  assert.equal(timeline.pages, 3);
});
test("streamed exports remain valid, exclude bot credentials, and provide Arabic CSV headers", async () => {
  const response = await request("/admin/export");
  assert.equal(response.status, 200);
  assert.equal(response.body.format, "alpaca-store-v1");
  assert.equal(response.body.products.length, 32);
  assert.equal(response.body.store.telegram, undefined);
  assert.ok(response.body.analytics.events.length > 205);
  const csv = await originalFetch(base + "/api/admin/orders-export?lang=ar", {
    headers: { Cookie: cookie },
  });
  const text = await csv.text();
  assert.equal(csv.status, 200);
  assert.ok(text.includes("العميل"));
  assert.ok(text.includes("عميل الاختبار"));
  assert.ok(text.includes("'+966"));
});
test("malformed nested product data and checkout lines return clear validation errors", async () => {
  const product = (await request("/admin/products/alpaca-scarf")).body;
  for (const bad of [
    { variants: [null] },
    { images: [null] },
    { additional_info: [null] },
    { status: "mistyped" },
  ])
    assert.equal(
      (
        await request("/admin/products/alpaca-scarf", "PUT", {
          ...product,
          ...bad,
        })
      ).status,
      400,
    );
  assert.equal(
    (await request("/orders", "POST", order({ items: [null] }))).status,
    400,
  );
});

test("environment passwords preserve intentional leading/trailing spaces", () => {
  const folder = mkdtempSync(path.join(os.tmpdir(), "boutique-password-"));
  try {
    const script = `import {app} from './server/index.js';import {db} from './server/db.js';const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const statuses=[];for(const password of [process.env.ADMIN_PASSWORD,process.env.ADMIN_PASSWORD.trim()]){const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});statuses.push(response.status);}console.log(JSON.stringify(statuses));await new Promise(resolve=>server.close(resolve));db.close();`;
    const result = execFileSync(
      process.execPath,
      ["--input-type=module", "-e", script],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DATA_DIR: folder,
          ADMIN_PASSWORD: " test-password-with-spaces ",
        },
      },
    );
    assert.deepEqual(JSON.parse(result), [200, 401]);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("an unavailable encryption key does not prevent dashboard access or order storage", async () => {
  const { setSetting } = await import("../server/db.js");
  setSetting("telegram", {
    token: "invalid-encrypted-value",
    chatId: "123456789",
  });
  const config = await request("/admin/telegram");
  assert.equal(config.status, 200);
  assert.equal(config.body.configured, false);
  assert.match(config.body.credentialsError, /Re-enter/);
  assert.equal(config.body.token, undefined);
  await telegram.deliverPending();
  const result = await request("/orders", "POST", order());
  assert.equal(result.status, 201);
  assert.equal(result.body.order.customer.name, customer.name);
  setSetting("telegram", {});
});
