import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { catalogue } from "../src/data/products.js";
import { parseCsv } from "../server/imports/csv.js";
import {
  validateDestination,
  publicAddress,
} from "../server/imports/safe-fetch.js";
import { reviewProduct, toVera } from "../server/imports/contracts.js";
process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "vera-ecosystem-"));
process.env.PLATFORM_MODE = "1";
process.env.NODE_ENV = "test";
process.env.OWNER_EMAILS = "owner@fixture.test";
let server, base, core, db, tenant, jobs, alice, bob, store;
async function req(url, { method = "GET", body, user = alice } = {}) {
  const r = await fetch(base + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(user ? { Cookie: "vera_session=" + user.session } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: r.status, data, cookie: r.headers.get("set-cookie") };
}
before(async () => {
  const { app } = await import("../server/platform/app.js");
  core = await import("../server/platform/core.js");
  db = await import("../server/db.js");
  tenant = await import("../server/tenant.js");
  jobs = await import("../server/imports/jobs.js");
  for (const [name, email] of [
    ["alice", "owner@fixture.test"],
    ["bob", "bob@fixture.test"],
  ]) {
    core
      .sql("INSERT INTO platform_users(sub,email,name,created) VALUES(?,?,?,?)")
      .run(name, email, name, Date.now());
    const u = core.sql("SELECT * FROM platform_users WHERE sub=?").get(name);
    u.session = "session-" + name;
    core
      .sql("INSERT INTO platform_sessions VALUES(?,?,?)")
      .run(core.hash(u.session), u.id, Date.now() + 86400000);
    if (name === "alice") alice = u;
    else bob = u;
  }
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
});
after(async () => {
  await new Promise((r) => server.close(r));
  db.rawDb.close();
  rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});
test("onboarding persists, resumes and creates one empty draft without extra password", async () => {
  const body = {
    name: "علامتي",
    slug: "ecosystem-draft",
    template: "atelier",
    language: "ar",
    currency: "EGP",
    country: "Egypt",
    step: 2,
  };
  assert.equal(
    (
      await req("/api/platform/onboarding/fixture-draft", {
        method: "PUT",
        body,
      })
    ).status,
    200,
  );
  assert.equal(
    (await req("/api/platform/onboarding")).data.drafts[0].data.name,
    body.name,
  );
  assert.equal(
    (
      await req("/api/platform/onboarding/fixture-draft", {
        method: "PUT",
        body,
        user: bob,
      })
    ).status,
    404,
  );
  const first = await req("/api/platform/onboarding/fixture-draft/commit", {
    method: "POST",
    body: {},
  });
  assert.equal(first.status, 201);
  store = first.data;
  assert.equal(store.publicationState, "draft");
  assert.equal(
    (
      await req("/api/platform/onboarding/fixture-draft/commit", {
        method: "POST",
        body: {},
      })
    ).data.id,
    store.id,
  );
  assert.equal(
    tenant.inTenant(store.id, store.url, () => db.productsAll().length),
    0,
  );
  assert.equal((await req(store.url, { user: null })).status, 503);
  assert.equal(
    (await req(store.url + "?preview=1", { user: bob })).status,
    503,
  );
  assert.equal((await req(store.url + "?preview=1")).status, 200);
  assert.equal(
    (
      await req(store.url + "/api/orders?preview=1", {
        method: "POST",
        body: {},
      })
    ).status,
    403,
  );
});
test("readiness does not publish incomplete drafts and requires entitlement", async () => {
  assert.equal(
    (
      await req(`/api/platform/stores/${store.id}/publish`, {
        method: "POST",
        body: {},
      })
    ).status,
    409,
  );
  tenant.inTenant(store.id, store.url, () => {
    const p = structuredClone(catalogue[0]);
    p.variants.forEach((v) => {
      v.currency = "EGP";
      v.currency_info = { code: "EGP", symbol: "EGP", decimal_digits: 2 };
      v.manage_inventory = true;
      v.inventory_quantity = 3;
    });
    db.stmt("INSERT INTO products(id,data,position) VALUES(?,?,0)").run(
      p.id,
      JSON.stringify(p),
    );
    db.indexProductVariants(p);
    const s = db.getSetting("store");
    s.footer.email = "merchant@fixture.test";
    db.setSetting("store", s);
  });
  assert.equal(
    (
      await req(`/api/platform/stores/${store.id}/launch-review`, {
        method: "PATCH",
        body: { policies: true, mobile: true },
      })
    ).data.canPublish,
    true,
  );
  core.sql("UPDATE platform_stores SET trial_until=0 WHERE id=?").run(store.id);
  assert.equal(
    (
      await req(`/api/platform/stores/${store.id}/publish`, {
        method: "POST",
        body: {},
      })
    ).status,
    409,
  );
  core
    .sql("UPDATE platform_stores SET trial_until=? WHERE id=?")
    .run(Date.now() + 86400000, store.id);
  assert.equal(
    (
      await req(`/api/platform/stores/${store.id}/publish`, {
        method: "POST",
        body: {},
      })
    ).status,
    200,
  );
  assert.equal(
    (await req(store.url + "/api/products", { user: null })).status,
    200,
  );
});
test("session bridge is owned, supports paused stores, deep routes and account logout revokes only its issued sessions", async () => {
  assert.equal(
    (
      await req(`/api/platform/stores/${store.id}/admin-entry`, {
        method: "POST",
        body: {},
        user: bob,
      })
    ).status,
    404,
  );
  await req(`/api/platform/stores/${store.id}`, {
    method: "PATCH",
    body: { paused: true },
  });
  const bridge = await req(`/api/platform/stores/${store.id}/admin-entry`, {
    method: "POST",
    body: {},
  });
  assert.equal(bridge.status, 200);
  assert.equal(
    (await req(`/workspace/stores/${store.id}/products?product=alpaca-beanie`))
      .status,
    200,
  );
  const cookie = bridge.cookie.split(";")[0];
  assert.equal(
    (
      await fetch(base + store.url + "/api/admin/session", {
        headers: { Cookie: cookie },
      })
    ).status,
    200,
  );
  await req("/api/platform/logout", { method: "POST", body: {} });
  assert.equal(
    (
      await fetch(base + store.url + "/api/admin/session", {
        headers: { Cookie: cookie },
      })
    ).status,
    401,
  );
  core
    .sql("INSERT INTO platform_sessions VALUES(?,?,?)")
    .run(core.hash(alice.session), alice.id, Date.now() + 86400000);
});
test("CSV Arabic headers preserve currency, source identity and missing stock, reject 41 variants", () => {
  const p = parseCsv(
    "معرف,الاسم,الصورة,السعر,العملة,المخزون\nabc,قطعة,https://example.com/image.png,100,USD,\n",
  )[0];
  assert.equal(p.currency, "USD");
  assert.equal(p.variants[0].priceMinor, 10000);
  assert.equal(p.variants[0].stockKnown, false);
  assert.ok(reviewProduct(p).includes("INVENTORY_REVIEW_REQUIRED"));
  const fortyone = {
    ...p,
    variants: Array.from({ length: 41 }, () => ({
      ...p.variants[0],
      stockKnown: true,
      stock: 1,
    })),
  };
  assert.ok(reviewProduct(fortyone).includes("UNSUPPORTED_VARIANT_COUNT"));
  assert.throws(() => toVera(fortyone, ["/assets/hero.jpg"]));
});
test("SafeFetch rejects private IPv4/IPv6, userinfo, DNS rebinding and metadata destinations", async () => {
  for (const url of [
    "http://127.0.0.1",
    "http://169.254.169.254",
    "http://[::1]",
    "http://[::ffff:127.0.0.1]",
    "http://10.0.0.1",
    "file:///tmp/file",
    "https://user:password@example.com",
  ])
    await assert.rejects(() => validateDestination(url));
  await assert.rejects(() =>
    validateDestination("https://example.com", async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]),
  );
  assert.equal(publicAddress("8.8.8.8"), true);
});
test("import snapshot and ownership survive repeated job/commit requests; unknown stock is not published", async () => {
  const body = {
    sourceType: "csv",
    ownsContent: true,
    requestKey: "import-fixture-one",
    csv: "id,title,image,price,currency,stock\nsource-1,Imported piece,https://example.com/image.jpg,20,USD,2",
  };
  const created = await req("/api/platform/import-jobs", {
    method: "POST",
    body,
  });
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.equal(
    (await req("/api/platform/import-jobs", { method: "POST", body })).data.id,
    id,
  );
  assert.equal(
    (await req("/api/platform/import-jobs/" + id, { user: bob })).status,
    404,
  );
  await jobs.runJob(
    core.sql("SELECT * FROM platform_import_jobs WHERE id=?").get(id),
  );
  assert.equal(
    (await req("/api/platform/import-jobs/" + id)).data.state,
    "awaiting_review",
  );
  const item = (await req("/api/platform/import-jobs/" + id + "/items")).data
    .items[0];
  assert.equal(
    (
      await req("/api/platform/import-jobs/" + id + "/selection", {
        method: "PATCH",
        body: { itemId: item.id, selected: true },
      })
    ).status,
    200,
  );
  const commit = {
    name: "Import draft",
    slug: "import-draft",
    template: "form",
    currency: "USD",
  };
  const first = await req("/api/platform/import-jobs/" + id + "/commit", {
    method: "POST",
    body: commit,
  });
  assert.equal(first.status, 200);
  assert.equal(
    (
      await req("/api/platform/import-jobs/" + id + "/commit", {
        method: "POST",
        body: commit,
      })
    ).data.storeId,
    first.data.storeId,
  );
  assert.equal(
    core
      .sql("SELECT publication_state FROM platform_stores WHERE id=?")
      .get(first.data.storeId).publication_state,
    "draft",
  );
  await req("/api/platform/import-jobs/" + id + "/cancel", {
    method: "POST",
    body: {},
  });
  assert.equal(
    (await req("/api/platform/import-jobs/" + id)).data.state,
    "cancelled",
  );
});
test("display currency migration and owner reporting keep currencies distinct", async () => {
  assert.equal(
    (await req("/api/platform/owner/overview", { user: bob })).status,
    403,
  );
  const settings = {
    marketingPriceCents: 150,
    supportEmail: "support@fixture.test",
    displayPricing: {
      displayDefaultCurrency: "EGP",
      displayPrices: { USD: 150, EGP: 7500 },
    },
  };
  assert.equal(
    (
      await req("/api/platform/owner/settings", {
        method: "PATCH",
        body: settings,
      })
    ).status,
    200,
  );
  assert.equal(
    (await req("/api/platform/config")).data.displayPricing.displayPrices.EGP,
    7500,
  );
  assert.equal(
    (await req("/api/platform/owner/merchants?q=alice")).data.items.length,
    1,
  );
  assert.equal(
    (
      await req("/api/platform/owner/stores?publication=draft")
    ).data.items.every((s) => s.publicationState === "draft"),
    true,
  );
});
test("worker recovers an expired lease, copies decoded local images and commits each source once", async () => {
  const sharp = (await import("sharp")).default;
  const buffer = await sharp({
    create: { width: 16, height: 16, channels: 3, background: "#743f37" },
  })
    .png()
    .toBuffer();
  const j = jobs.createJob(alice, {
    sourceType: "csv",
    ownsContent: true,
    requestKey: "worker-resume-fixture",
    csv: "id,title,image,price,currency,stock\nresume-1,Resumed product,https://example.com/real-image.png,25,USD,4",
  });
  await jobs.runJob(j);
  const row = () =>
      core.sql("SELECT * FROM platform_import_jobs WHERE id=?").get(j.id),
    item = core
      .sql("SELECT * FROM platform_import_items WHERE job_id=?")
      .get(j.id);
  core
    .sql("UPDATE platform_import_items SET selected=1 WHERE id=?")
    .run(item.id);
  const target = jobs.commitJob(row(), alice, {
    name: "Resumed import",
    slug: "resumed-import",
    template: "atelier",
    currency: "USD",
  });
  core
    .sql("UPDATE platform_import_jobs SET lease=? WHERE id=?")
    .run(Date.now() + 60000, j.id);
  let fetched = 0;
  const dependencies = {
    fetchImage: async () => {
      fetched++;
      return { buffer };
    },
  };
  await jobs.runJob(row(), dependencies);
  assert.equal(fetched, 0);
  core
    .sql("UPDATE platform_import_jobs SET lease=? WHERE id=?")
    .run(Date.now() - 1, j.id);
  await jobs.runJob(row(), dependencies);
  assert.equal(fetched, 1);
  await jobs.runJob(row(), dependencies);
  assert.equal(row().state, "ready");
  const products = tenant.inTenant(target, "/s/resumed-import", () =>
    db.productsAll(),
  );
  assert.equal(products.length, 1);
  assert.equal(products[0].status, "draft");
  assert.match(products[0].images[0].url, /^\/uploads\/[a-f0-9]{64}\.webp$/);
  assert.equal(products[0].variants[0].inventory_quantity, 4);
  assert.equal(jobs.commitJob(row(), alice, { currency: "USD" }), target);
  await jobs.runJob(row(), dependencies);
  assert.equal(fetched, 1);
  assert.equal(
    core
      .sql("SELECT count(*) n FROM platform_source_mappings WHERE store_id=?")
      .get(target).n,
    1,
  );
});
test("SafeFetch rechecks redirects, caps bodies and reports bounded Retry-After", async () => {
  const { safeFetch } = await import("../server/imports/safe-fetch.js"),
    lookup = async () => [{ address: "93.184.216.34", family: 4 }];
  await assert.rejects(
    () =>
      safeFetch("https://example.com", {
        lookup,
        transport: async () =>
          new Response(null, {
            status: 302,
            headers: { location: "http://169.254.169.254" },
          }),
      }),
    /SOURCE_PRIVATE_ADDRESS/,
  );
  await assert.rejects(
    () =>
      safeFetch("https://example.com", {
        lookup,
        maxBytes: 2,
        transport: async () =>
          new Response("large", {
            headers: { "content-type": "application/json" },
          }),
      }),
    /SOURCE_TOO_LARGE/,
  );
  await assert.rejects(
    () =>
      safeFetch("https://example.com", {
        lookup,
        transport: async () =>
          new Response(null, { status: 429, headers: { "retry-after": "20" } }),
      }),
    (e) => e.retryable && e.retryAfter === 20000,
  );
});
test("public structured-data fallback retains unknown inventory and source currency", async () => {
  const { structuredProducts } = await import("../server/imports/discovery.js");
  const p = structuredProducts(
    '<script type="application/ld+json">' +
      JSON.stringify({
        "@type": "Product",
        name: "قطعة",
        sku: "abc",
        image: "/image.png",
        offers: {
          price: "100.50",
          priceCurrency: "EGP",
          availability: "InStock",
        },
      }) +
      "</script>",
    "https://shop.example/products/abc",
  )[0];
  assert.equal(p.currency, "EGP");
  assert.equal(p.variants[0].priceMinor, 10050);
  assert.equal(p.variants[0].stockKnown, false);
  assert.equal(p.images[0], "https://shop.example/image.png");
});
test("repricing is explicit, updates variants and preserves immutable old order data", async () => {
  const bridge = await req(`/api/platform/stores/${store.id}/admin-entry`, {
      method: "POST",
      body: {},
    }),
    cookie = bridge.cookie.split(";")[0];
  const admin = async (method, body) => {
    const response = await fetch(base + store.url + "/api/admin/store", {
      method,
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  };
  const oldOrder = JSON.stringify({
    currency: "EGP",
    subtotal: 10000,
    items: [{ title: "Historic piece", price_in_cents: 10000 }],
  });
  tenant.inTenant(store.id, store.url, () =>
    db
      .stmt(
        "INSERT INTO orders(number,token,idempotency_key,created_at,data) VALUES(?,?,?,?,?)",
      )
      .run(
        "V-OLD",
        "old-order-token",
        "old-order-key",
        new Date().toISOString(),
        oldOrder,
      ),
  );
  const settings = (await admin("GET")).data;
  const before = tenant.inTenant(
    store.id,
    store.url,
    () => db.productsAll()[0].variants[0].price_in_cents,
  );
  settings.checkout.currency = "USD";
  settings.checkout.symbol = "$";
  assert.equal((await admin("PUT", settings)).status, 409);
  settings.currencyChange = { action: "reprice", rate: 0.02 };
  assert.equal((await admin("PUT", settings)).status, 200);
  tenant.inTenant(store.id, store.url, () => {
    assert.equal(
      db.productsAll()[0].variants[0].price_in_cents,
      Math.round(before * 0.02),
    );
    assert.equal(
      db.stmt("SELECT data FROM orders WHERE number=?").get("V-OLD").data,
      oldOrder,
    );
  });
});
test("provider plan versions and feature flags preserve existing snapshots and stores", async () => {
  const { providerPlan } = await import("../server/platform/pricing.js");
  const original = { ...process.env };
  try {
    Object.assign(process.env, {
      PAYMOB_CURRENCY: "EGP",
      PAYMOB_AMOUNT_CENTS: "7500",
      PAYMOB_PLAN_ID: "123",
      PAYMOB_INTEGRATION_ID: "1",
      PAYMOB_MOTO_ID: "2",
    });
    const first = providerPlan();
    process.env.PAYMOB_AMOUNT_CENTS = "9000";
    const next = providerPlan();
    assert.notEqual(first.id, next.id);
    assert.equal(
      core
        .sql("SELECT amount_minor FROM platform_price_plans WHERE id=?")
        .get(first.id).amount_minor,
      7500,
    );
  } finally {
    for (const key of [
      "PAYMOB_CURRENCY",
      "PAYMOB_AMOUNT_CENTS",
      "PAYMOB_PLAN_ID",
      "PAYMOB_INTEGRATION_ID",
      "PAYMOB_MOTO_ID",
    ])
      original[key] === undefined
        ? delete process.env[key]
        : (process.env[key] = original[key]);
  }
  const settings = (await req("/api/platform/owner/settings")).data;
  settings.features.importCsv = false;
  assert.equal(
    (
      await req("/api/platform/owner/settings", {
        method: "PATCH",
        body: settings,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req("/api/platform/import-jobs", {
        method: "POST",
        body: {
          sourceType: "csv",
          ownsContent: true,
          requestKey: "disabled-feature",
        },
      })
    ).status,
    503,
  );
  assert.equal((await req(store.url + "/api/admin/bootstrap")).status, 200);
  settings.features.importCsv = true;
  await req("/api/platform/owner/settings", {
    method: "PATCH",
    body: settings,
  });
});
test("online backup and disposable restore preserve stores, images and encrypted credentials", async () => {
  const { spawnSync } = await import("node:child_process"),
    { existsSync } = await import("node:fs");
  const target = path.join(os.tmpdir(), "vera-backup-" + crypto.randomUUID());
  core
    .sql("INSERT INTO platform_import_connections VALUES(?,?,?,?,?,?,?)")
    .run(
      "backup-connection",
      alice.id,
      "woocommerce",
      "fixture.test",
      db.encrypt(
        JSON.stringify({ key: "fixture-read-key", secret: "fixture-secret" }),
      ),
      "active",
      Date.now(),
    );
  try {
    const backup = spawnSync(process.execPath, ["scripts/backup.js", target], {
      env: process.env,
      encoding: "utf8",
    });
    assert.equal(backup.status, 0, backup.stderr);
    assert.equal(existsSync(path.join(target, ".encryption-key")), true);
    const verification = spawnSync(
      process.execPath,
      ["scripts/verify-backup.js", target],
      { env: process.env, encoding: "utf8", timeout: 30000 },
    );
    assert.equal(verification.status, 0, verification.stderr);
    const report = JSON.parse(verification.stdout);
    assert.equal(report.ok, true);
    assert.equal(report.encryptedConnectionsVerified, 1);
    assert.ok(report.restoredStores >= 3);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});
test("owner filters and retry retain merchant ownership, require a reason and record an audit", async () => {
  const source = {
    sourceType: "csv",
    ownsContent: true,
    requestKey: "owner-retry-case",
    csv: "id,title,image,price,currency,stock\nretry-case,Piece,https://example.com/image.jpg,20,USD,2",
  };
  const job = jobs.createJob(bob, source);
  core
    .sql("UPDATE platform_import_jobs SET state='failed' WHERE id=?")
    .run(job.id);
  const endpoint = "/api/platform/owner/imports/" + job.id + "/retry";
  assert.equal(
    (
      await req(endpoint, {
        method: "POST",
        body: { reason: "network recovered" },
        user: bob,
      })
    ).status,
    403,
  );
  assert.equal(
    (await req(endpoint, { method: "POST", body: { reason: "x" } })).status,
    400,
  );
  assert.equal(
    (
      await req(endpoint, {
        method: "POST",
        body: { reason: "network recovered" },
      })
    ).status,
    200,
  );
  const persisted = core
    .sql("SELECT * FROM platform_import_jobs WHERE id=?")
    .get(job.id);
  assert.equal(persisted.owner_id, bob.id);
  assert.equal(persisted.state, "queued");
  assert.ok(
    core
      .sql(
        "SELECT id FROM platform_audit WHERE actor=? AND action='owner.import_retried'",
      )
      .get(alice.id),
  );
  assert.equal(
    (await req(endpoint, { method: "POST", body: { reason: "repeat" } }))
      .status,
    409,
  );
  assert.equal(
    (await req("/api/platform/owner/merchants?q=bob&activity=active")).data
      .items[0].id,
    bob.id,
  );
  const exportFile = await req(
    "/api/platform/owner/merchants-export?q=bob&until=1",
  );
  assert.equal(exportFile.status, 200);
  assert.equal(exportFile.data.includes("bob@fixture.test"), false);
  assert.equal(
    (
      await req("/api/platform/owner/stores?publication=draft")
    ).data.items.every(
      (s) =>
        s.publicationState === "draft" &&
        s.readiness.checks.length === 6 &&
        Array.isArray(s.history),
    ),
    true,
  );
});
test("CSV retains missing prices and requires explicit review of mixed source currencies", () => {
  const missing = parseCsv(
    "id,title,image,price,currency,stock\nmissing,Piece,https://example.com/a.jpg,,USD,1",
  )[0];
  assert.equal(missing.variants.length, 1);
  assert.ok(reviewProduct(missing).includes("PRICE_REQUIRED"));
  const mixed = parseCsv(
    "id,title,image,price,currency,stock,sku\np,Piece,https://example.com/a.jpg,12,USD,1,a\np,Piece,https://example.com/a.jpg,10,EGP,1,b",
  )[0];
  assert.ok(reviewProduct(mixed).includes("MIXED_SOURCE_CURRENCIES"));
  mixed.priceCurrencyReviewed = true;
  assert.ok(!reviewProduct(mixed).includes("MIXED_SOURCE_CURRENCIES"));
});

test("sitemaps include only available public stores and published products, and private previews prevent caching", async () => {
  const publicStore = core.provision(alice, {
    name: "SEO public",
    slug: "seo-public",
    template: "atelier",
    password: "seo-test-password-123",
  });
  const privateStore = core.provision(bob, {
    name: "SEO private",
    slug: "seo-private",
    template: "atelier",
    password: "seo-test-password-123",
  });
  core
    .sql("UPDATE platform_stores SET publication_state='published' WHERE id=?")
    .run(publicStore.id);
  tenant.inTenant(publicStore.id, publicStore.url, () => {
    for (const [index, status] of ["published", "draft"].entries()) {
      const p = structuredClone(catalogue[0]);
      p.id = "seo-" + status;
      p.status = status;
      db.stmt("INSERT INTO products(id,data,position) VALUES(?,?,?)").run(
        p.id,
        JSON.stringify(p),
        index,
      );
    }
  });
  const index = await req("/sitemap.xml", { user: null });
  assert.equal(index.status, 200);
  assert.ok(index.data.includes("/s/seo-public/sitemap.xml"));
  assert.ok(!index.data.includes("/s/seo-private"));
  const products = await req(publicStore.url + "/sitemap.xml", { user: null });
  assert.equal(products.status, 200);
  assert.ok(products.data.includes("/product/seo-published"));
  assert.ok(!products.data.includes("/product/seo-draft"));
  const robots = await req("/robots.txt", { user: null });
  assert.ok(robots.data.includes("Disallow: /demo/"));
  assert.ok(robots.data.includes("Disallow: /workspace"));
  const preview = await fetch(base + privateStore.url + "?preview=1", {
    headers: { Cookie: "vera_session=" + bob.session },
  });
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get("cache-control"), /private,no-store/);
  assert.match(preview.headers.get("x-robots-tag"), /noindex/);
  await preview.arrayBuffer();
  assert.equal(
    (await req(privateStore.url + "/sitemap.xml", { user: null })).status,
    503,
  );
});
