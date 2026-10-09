import { publishFixture } from "./helpers/merchant-fixture.js";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID, createHmac } from "node:crypto";
process.env.DATA_DIR = mkdtempSync(
  path.join(os.tmpdir(), "vera-platform-test-"),
);
process.env.NODE_ENV = "test";
process.env.PLATFORM_MODE = "1";
process.env.OWNER_EMAILS = "owner@example.test";
let server, base, core, db, tenant, alice, bob, a, b, adminA, adminB;
const password = "A-long-private-password-123";
async function req(
  url,
  { method = "GET", body, cookie, headers = {}, redirect = "follow" } = {},
) {
  const r = await fetch(base + url, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect,
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (url === "/api/platform/stores" && method === "POST" && r.status === 201)
    publishFixture(core, db, tenant, data, { seed: true });
  return { status: r.status, data, headers: r.headers };
}
function user(sub, email) {
  core
    .sql("INSERT INTO platform_users(sub,email,name,created) VALUES(?,?,?,?)")
    .run(sub, email, sub, Date.now());
  const u = core.sql("SELECT * FROM platform_users WHERE sub=?").get(sub),
    token = core.token();
  core
    .sql("INSERT INTO platform_sessions(hash,user_id,expires) VALUES(?,?,?)")
    .run(core.hash(token), u.id, Date.now() + 86400000);
  return { ...u, cookie: "vera_session=" + token };
}
before(async () => {
  const { app } = await import("../server/platform/app.js");
  core = await import("../server/platform/core.js");
  db = await import("../server/db.js");
  tenant = await import("../server/tenant.js");
  alice = user("Alice", "owner@example.test");
  bob = user("Bob", "bob@example.test");
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
});
after(async () => {
  await new Promise((r) => server.close(r));
  db.rawDb.close();
  rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});
test("platform denies anonymous access, cross-site writes, owner escalation and forged OAuth state", async () => {
  assert.equal((await req("/api/platform/stores")).status, 401);
  assert.equal(
    (await req("/api/platform/owner", { cookie: bob.cookie })).status,
    403,
  );
  assert.equal(
    (
      await req("/api/platform/stores", {
        method: "POST",
        cookie: alice.cookie,
        body: {},
        headers: { origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  const callback = await req(
    "/api/platform/auth/callback?state=forged&code=fake",
    { redirect: "manual" },
  );
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), "/login?error=google");
  assert.equal(
    (
      await req("/api/admin/login", {
        method: "POST",
        body: { password: "admin@admin" },
      })
    ).status,
    404,
  );
  assert.equal((await req("/demo/atelier/api/admin/session")).status, 403);
  assert.equal(
    (await req("/demo/atelier/api/orders", { method: "POST", body: {} }))
      .status,
    403,
  );
});
test("provisions two isolated stores in one SQLite file without inherited sessions or orders", async () => {
  const ar = await req("/api/platform/stores", {
    method: "POST",
    cookie: alice.cookie,
    body: {
      name: "Maison Alice",
      slug: "maison-alice",
      template: "atelier",
      password,
      owner_id: bob.id,
    },
  });
  assert.equal(ar.status, 201, JSON.stringify(ar.data));
  a = ar.data;
  const br = await req("/api/platform/stores", {
    method: "POST",
    cookie: bob.cookie,
    body: {
      name: "Maison Bob",
      slug: "maison-bob",
      template: "atelier",
      password,
    },
  });
  assert.equal(br.status, 201);
  b = br.data;
  assert.equal(
    core.sql("SELECT owner_id FROM platform_stores WHERE id=?").get(a.id)
      .owner_id,
    alice.id,
  );
  assert.equal(
    (await req("/api/platform/stores", { cookie: alice.cookie })).data.stores
      .length,
    1,
  );
  assert.equal(
    (
      await req(`/api/platform/stores/${a.id}/password`, {
        method: "POST",
        cookie: bob.cookie,
        body: { password },
      })
    ).status,
    404,
  );
  assert.equal(
    (await req("/s/maison-alice/api/store")).data.name,
    "Maison Alice",
  );
  assert.equal((await req("/s/maison-bob/api/store")).data.name, "Maison Bob");
  assert.equal(
    (
      await req("/api/platform/stores", {
        method: "POST",
        cookie: alice.cookie,
        body: {
          name: "Duplicate",
          slug: a.slug,
          template: "atelier",
          password,
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("/api/platform/stores", {
        method: "POST",
        cookie: alice.cookie,
        body: {
          name: "Invalid",
          slug: 'a";DROP',
          template: "atelier",
          password,
        },
      })
    ).status,
    400,
  );
});
test("scoped catalogue queries use the tenant index and preserve preview isolation", async () => {
  const catalogue = await req("/s/maison-alice/api/products?sort=price-asc");
  assert.equal(catalogue.status, 200, JSON.stringify(catalogue.data));
  assert.equal(catalogue.data.total, 4);
  const preview = await req("/demo/atelier/api/products");
  assert.equal(preview.status, 200, JSON.stringify(preview.data));
  assert.equal(preview.data.total, 4);
  assert.equal((await req("/demo/unknown/api/store")).status, 404);
});
test("admin cookies and prepared statements never authorize or mutate a different tenant", async () => {
  for (const [s, u] of [
    [a, alice],
    [b, bob],
  ]) {
    const r = await req(`/api/platform/stores/${s.id}/admin-entry`, {
      method: "POST",
      cookie: u.cookie,
      body: {},
    });
    assert.equal(r.status, 200);
    const c = r.headers.get("set-cookie").split(";")[0];
    assert.match(r.headers.get("set-cookie"), new RegExp("Path=/s/" + s.slug));
    if (s === a) adminA = c;
    else adminB = c;
  }
  assert.equal(
    (await req("/s/maison-bob/api/admin/store", { cookie: adminA })).status,
    401,
  );
  const before = (
    await req("/s/maison-alice/api/admin/store", { cookie: adminA })
  ).data;
  const updated = await req("/s/maison-alice/api/admin/store", {
    method: "PUT",
    cookie: adminA,
    body: { ...before, name: "Alice changed" },
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.data));
  const responses = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      req("/s/" + (i % 2 ? "maison-bob" : "maison-alice") + "/api/store"),
    ),
  );
  responses.forEach((r, i) =>
    assert.equal(r.data.name, i % 2 ? "Maison Bob" : "Alice changed"),
  );
});
test("order identity, inventory, receipt access, analytics and export are tenant scoped", async () => {
  const idempotency_key = randomUUID();
  const body = {
    idempotency_key,
    payment_method: "cod",
    items: [{ variant_id: "alpaca-scarf-grey", quantity: 1 }],
    customer: {
      name: "Test Customer",
      phone: "+1 555 123 4567",
      email: "buyer@example.test",
      address: "12 Test Street, Unit 4",
      city: "Portland",
      region: "Oregon",
      postalCode: "97201",
      country: "United States",
      location: "https://maps.google.com/?q=Portland",
      notes: "",
    },
  };
  const response = await req("/s/maison-alice/api/orders", {
    method: "POST",
    body,
  });
  assert.equal(response.status, 201, JSON.stringify(response.data));
  assert.equal(
    tenant.inTenant(
      a.id,
      a.url,
      () => db.db.prepare("SELECT count(*) n FROM orders").get().n,
    ),
    1,
  );
  assert.equal(
    tenant.inTenant(
      b.id,
      b.url,
      () => db.db.prepare("SELECT count(*) n FROM orders").get().n,
    ),
    0,
  );
  assert.equal(
    (await req("/s/maison-bob/api/orders", { method: "POST", body })).status,
    201,
  );
  const receipt = tenant.inTenant(
    a.id,
    a.url,
    () => db.db.prepare("SELECT token FROM orders").get().token,
  );
  assert.equal(
    (await req("/s/maison-bob/api/receipts/" + receipt)).status,
    404,
  );
  const exportB = await req("/s/maison-bob/api/admin/export", {
    cookie: adminA,
  });
  assert.equal(exportB.status, 401);
  const backupA = await req(a.url + "/api/admin/export", { cookie: adminA });
  const backupB = await req(b.url + "/api/admin/export", { cookie: adminB });
  assert.equal(backupA.data.store.name, "Alice changed");
  assert.equal(backupB.data.store.name, "Maison Bob");
  assert.equal(backupA.data.orders.length, 1);
  assert.equal(backupB.data.orders.length, 1);
  assert.equal(backupA.data.orders[0].customer.name, "Test Customer");
  assert.equal(backupA.data.orders[0].token, undefined);
  assert.equal(backupB.data.orders[0].token, undefined);
  const { analyticsReport } = await import("../server/analytics.js");
  tenant.inTenant(a.id, a.url, () =>
    db.db
      .prepare(
        "INSERT INTO visits(id,visitor,started_at,last_at,entry,exit) VALUES(?,?,?,?,?,?)",
      )
      .run(randomUUID(), randomUUID(), Date.now(), Date.now(), "/", "/"),
  );
  const reportA = tenant.inTenant(a.id, a.url, () => analyticsReport(30, 0));
  const reportB = tenant.inTenant(b.id, b.url, () => analyticsReport(30, 0));
  assert.notDeepEqual(reportA, reportB);
});
test("pause and trial expiry hide the public store while retaining protected admin access", async () => {
  assert.equal(
    (
      await req(`/api/platform/stores/${a.id}`, {
        method: "PATCH",
        cookie: alice.cookie,
        body: { paused: true },
      })
    ).status,
    200,
  );
  assert.equal((await req(a.url + "/api/store")).status, 503);
  assert.equal((await req(a.adminUrl)).status, 200);
  assert.equal(
    (await req(a.url + "/api/admin/store", { cookie: adminA })).status,
    200,
  );
  assert.equal((await req(b.url + "/api/store")).status, 200);
  await req(`/api/platform/stores/${a.id}`, {
    method: "PATCH",
    cookie: alice.cookie,
    body: { paused: false },
  });
  core.sql("UPDATE platform_stores SET trial_until=0 WHERE id=?").run(a.id);
  assert.equal((await req(a.url + "/api/store")).status, 503);
  core
    .sql("UPDATE platform_stores SET access_until=? WHERE id=?")
    .run(Date.now() + 86400000, a.id);
  assert.equal((await req(a.url + "/api/store")).status, 200);
});
test("password reset revokes previous tenant sessions, preserves other stores, and validates current password", async () => {
  const newPassword = "Different-private-password-789";
  assert.equal(
    (
      await req(`/api/platform/stores/${a.id}/password`, {
        method: "POST",
        cookie: alice.cookie,
        body: { password: newPassword },
      })
    ).status,
    200,
  );
  assert.equal(
    (await req(a.url + "/api/admin/store", { cookie: adminA })).status,
    401,
  );
  assert.equal(
    (await req(b.url + "/api/admin/store", { cookie: adminB })).status,
    200,
  );
  assert.equal(
    (
      await req(a.url + "/api/admin/login", {
        method: "POST",
        body: { password },
      })
    ).status,
    401,
  );
  const login = await req(a.url + "/api/admin/login", {
    method: "POST",
    body: { password: newPassword },
  });
  assert.equal(login.status, 200);
  adminA = login.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (
      await req(a.url + "/api/admin/password", {
        method: "POST",
        cookie: adminA,
        body: { currentPassword: "wrong", password },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await req(a.url + "/api/admin/password", {
        method: "POST",
        cookie: adminA,
        body: { currentPassword: newPassword, password },
      })
    ).status,
    200,
  );
  assert.equal(
    (await req(a.url + "/api/admin/session", { cookie: adminA })).status,
    401,
  );
});
test("owner suspension blocks public and dashboard access and records an audit trail", async () => {
  const summary = await req("/api/platform/owner", { cookie: alice.cookie });
  assert.equal(summary.status, 200);
  assert.equal(summary.data.counts.stores, 2);
  assert.equal(
    (
      await req("/api/platform/owner/stores/" + b.id, {
        method: "PATCH",
        cookie: bob.cookie,
        body: { suspended: true, reason: "Fixture suspension" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req("/api/platform/owner/stores/" + b.id, {
        method: "PATCH",
        cookie: alice.cookie,
        body: { suspended: true, reason: "Fixture suspension" },
      })
    ).status,
    200,
  );
  assert.equal(
    (await req(b.url + "/api/admin/store", { cookie: adminB })).status,
    503,
  );
  assert.equal(
    (
      await req(`/api/platform/stores/${b.id}/admin-entry`, {
        method: "POST",
        cookie: bob.cookie,
        body: {},
      })
    ).status,
    403,
  );
  assert.ok(
    core
      .sql(
        "SELECT id FROM platform_audit WHERE action='owner.suspended' AND store_id=?",
      )
      .get(b.id),
  );
});
test("tenant SQL rewriting preserves literals, comments and partial identifiers", () => {
  const s = tenant.tenantSQL(
    "SELECT data FROM products WHERE json_extract(data,'$.products')='orders' /* products */ -- orders\n",
    7,
  );
  assert.match(s, /FROM "t_7_products"/);
  assert.match(s, /'\$\.products'/);
  assert.match(s, /'orders'/);
  assert.match(s, /\/\* products \*\//);
  assert.throws(() => tenant.inTenant("evil", "/", () => {}));
});
test("Paymob HMAC validates signed field order and rejects tampering and missing signatures", async () => {
  const { verifyPaymobHmac } = await import("../server/platform/paymob.js");
  const obj = {
    amount_cents: 150,
    created_at: "2026-10-07",
    currency: "USD",
    error_occured: false,
    has_parent_transaction: false,
    id: 15,
    integration_id: 12,
    is_3d_secure: true,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_standalone_payment: true,
    is_voided: false,
    order: { id: 29 },
    owner: 5,
    pending: false,
    source_data: { pan: "2346", sub_type: "Visa", type: "card" },
    success: true,
  };
  const message =
    "1502026-10-07USDfalsefalse1512truefalsefalsefalsetruefalse295false2346Visacardtrue";
  const signature = createHmac("sha512", "secret")
    .update(message)
    .digest("hex");
  assert.equal(verifyPaymobHmac(obj, signature, "secret"), true);
  assert.equal(
    verifyPaymobHmac({ ...obj, amount_cents: 1 }, signature, "secret"),
    false,
  );
  assert.equal(verifyPaymobHmac(obj, "bad", "secret"), false);
});

test("Google code flow verifies signature, audience, nonce and verified email before creating a session", async () => {
  const { generateKeyPair, exportJWK, SignJWT } = await import("jose");
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const key = await exportJWK(publicKey);
  key.kid = "test";
  key.alg = "RS256";
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.PUBLIC_URL = base;
  const originalFetch = globalThis.fetch;
  let idToken;
  globalThis.fetch = async (url, options) => {
    const u = String(url);
    if (u === "https://oauth2.googleapis.com/token")
      return new Response(JSON.stringify({ id_token: idToken }), {
        headers: { "Content-Type": "application/json" },
      });
    if (u === "https://www.googleapis.com/oauth2/v3/certs")
      return new Response(JSON.stringify({ keys: [key] }), {
        headers: { "Content-Type": "application/json" },
      });
    return originalFetch(url, options);
  };
  try {
    for (const valid of [false, true]) {
      const start = await req("/api/platform/auth/google?intent=create", {
        redirect: "manual",
      });
      assert.equal(start.status, 302);
      const url = new URL(start.headers.get("location"));
      assert.equal(url.searchParams.get("code_challenge_method"), "S256");
      idToken = await new SignJWT({
        email: "verified@example.test",
        email_verified: true,
        name: "Verified",
        nonce: valid ? url.searchParams.get("nonce") : "wrong-nonce",
      })
        .setProtectedHeader({ alg: "RS256", kid: "test" })
        .setIssuer("https://accounts.google.com")
        .setAudience("test-client")
        .setSubject("verified-user")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);
      const callback = await req(
        "/api/platform/auth/callback?code=test-code&state=" +
          url.searchParams.get("state"),
        {
          cookie: start.headers.get("set-cookie").split(";")[0],
          redirect: "manual",
        },
      );
      assert.equal(
        callback.headers.get("location"),
        valid ? "/workspace/new" : "/login?error=google",
      );
      if (valid) {
        assert.match(callback.headers.get("set-cookie"), /vera_session=/);
        assert.ok(
          core
            .sql("SELECT id FROM platform_users WHERE sub=?")
            .get("verified-user"),
        );
      } else
        assert.equal(
          core
            .sql("SELECT id FROM platform_users WHERE sub=?")
            .get("verified-user"),
          undefined,
        );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("collections support multiple membership, exclude drafts, reject stale saves and stay tenant isolated", async () => {
  const login = await req(a.url + "/api/admin/login", {
    method: "POST",
    body: { password },
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const products = (await req(a.url + "/api/products")).data.products;
  const ids = products.slice(0, 2).map((p) => p.id);
  const collections = [
    {
      id: "winter-edit",
      name: "Winter",
      nameAr: "الشتاء",
      productIds: ids,
      published: true,
    },
    { id: "gift-edit", name: "Gifts", productIds: [ids[0]], published: true },
    { id: "draft-edit", name: "Draft", productIds: ids, published: false },
  ];
  const saved = await req(a.url + "/api/admin/collections", {
    method: "PUT",
    cookie,
    body: { version: 1, collections },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal(
    (await req(a.url + "/api/collections")).data.collections.length,
    2,
  );
  assert.equal(
    (await req(a.url + "/api/products?collection=winter-edit")).data.total,
    2,
  );
  assert.equal(
    (await req(a.url + "/api/products?collection=gift-edit")).data.total,
    1,
  );
  assert.equal(
    (await req(a.url + "/api/products?collection=draft-edit")).status,
    404,
  );
  assert.equal(
    (await req("/demo/atelier/api/collections")).data.collections.length,
    0,
  );
  assert.equal(
    (
      await req(a.url + "/api/admin/collections", {
        method: "PUT",
        cookie,
        body: { version: 1, collections },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req(a.url + "/api/admin/collections", {
        method: "PUT",
        body: { version: 2, collections },
      })
    ).status,
    401,
  );
});

test("legacy store import preserves original data and creates an independently protected namespace", async () => {
  const { execFileSync } = await import("node:child_process");
  const result = JSON.parse(
    execFileSync(process.execPath, ["scripts/import-legacy-store.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        IMPORT_OWNER_EMAIL: alice.email,
        IMPORT_STORE_SLUG: "imported-boutique",
        IMPORT_STORE_PASSWORD: password,
      },
      encoding: "utf8",
    }),
  );
  assert.equal(result.imported, true);
  const imported = core
    .sql("SELECT * FROM platform_stores WHERE slug=?")
    .get("imported-boutique");
  assert.equal(imported.owner_id, alice.id);
  assert.equal(
    tenant.inTenant(imported.id, result.url, () => db.getSetting("store").name),
    db.getSetting("store").name,
  );
  assert.equal((await req(result.url + "/api/products")).data.total, 4);
  assert.equal(
    (
      await req(result.url + "/api/admin/login", {
        method: "POST",
        body: { password },
      })
    ).status,
    200,
  );
  assert.equal(
    (await req(result.url + "/api/admin/store", { cookie: adminB })).status,
    401,
  );
});
