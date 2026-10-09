import { publishFixture } from "./helpers/merchant-fixture.js";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { formDemoProducts } from "../src/data/form-demo.js";
import { createHmac } from "node:crypto";
process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "vera-retail-"));
process.env.PLATFORM_MODE = "1";
process.env.NODE_ENV = "test";
let server, base, core, db, tenant, store;
async function req(url, body, cookie, method = body ? "POST" : "GET") {
  const r = await fetch(base + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
before(async () => {
  const { app } = await import("../server/platform/app.js");
  core = await import("../server/platform/core.js");
  db = await import("../server/db.js");
  tenant = await import("../server/tenant.js");
  core
    .sql("INSERT INTO platform_users(sub,email,name,created) VALUES(?,?,?,?)")
    .run("retail", "owner@test.example", "Owner", Date.now());
  store = core.provision(
    core.sql("SELECT * FROM platform_users WHERE sub=?").get("retail"),
    {
      name: "Test FORM",
      slug: "test-form",
      template: "form",
      password: "long-private-password",
    },
  );
  publishFixture(core, db, tenant, store);
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
});
after(async () => {
  await new Promise((r) => server.close(r));
  db.rawDb.close();
  rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});
test("shopper sessions are private, tenant scoped and never grant merchant access", async () => {
  const signup = await req(store.url + "/api/retail/register", {
    name: "Shopper",
    email: "shopper@example.test",
    password: "private-password-123",
  });
  assert.equal(signup.status, 201);
  assert.ok(signup.cookie);
  assert.equal(
    (await req(store.url + "/api/retail/session", null, signup.cookie)).data
      .customer.email,
    "shopper@example.test",
  );
  assert.equal(
    (await req("/demo/atelier/api/retail/session", null, signup.cookie)).data
      .customer,
    null,
  );
  assert.equal(
    (await req(store.url + "/api/admin/store", null, signup.cookie)).status,
    401,
  );
  assert.equal(
    (
      await req(store.url + "/api/retail/login", {
        email: "shopper@example.test",
        password: "wrong-password-123",
      })
    ).status,
    401,
  );
  assert.equal((await req(store.url + "/api/retail/orders", null)).status, 401);
  assert.equal(
    (await req(store.url + "/api/retail/saved", null, signup.cookie)).data
      .initialized,
    false,
  );
  assert.equal(
    (
      await req(
        store.url + "/api/retail/saved",
        { ids: [] },
        signup.cookie,
        "PUT",
      )
    ).status,
    200,
  );
  assert.equal(
    (await req(store.url + "/api/retail/saved", null, signup.cookie)).data
      .initialized,
    true,
  );
});
test("tracking requires a receipt capability and reviews require a delivered purchase", async () => {
  const login = await req(store.url + "/api/retail/login", {
    email: "shopper@example.test",
    password: "private-password-123",
  });
  assert.equal(
    (await req(store.url + "/api/retail/track", { token: "invalid" })).status,
    404,
  );
  assert.equal(
    (
      await req(
        store.url + "/api/retail/reviews",
        { orderId: 1, productId: "missing", rating: 5, body: "Great" },
        login.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await req(
        store.url + "/api/retail/returns",
        { orderId: 1, reason: "Return please", type: "return" },
        login.cookie,
      )
    ).status,
    403,
  );
});

test("saving store design preserves server-owned template identity and rejects stale changes", async () => {
  const admin = await req(store.url + "/api/admin/login", {
    password: "long-private-password",
  });
  const before = (await req(store.url + "/api/admin/store", null, admin.cookie))
    .data;
  const changes = {
    ...before,
    _template: { id: "atelier", renderer: "boutique" },
    form: { ...before.form, mobilePosition: 85 },
  };
  const saved = await req(
    store.url + "/api/admin/store",
    changes,
    admin.cookie,
    "PUT",
  );
  assert.equal(saved.status, 200);
  assert.equal(saved.data._template.renderer, "form");
  assert.equal(saved.data.form.mobilePosition, 85);
  assert.equal(
    (await req(store.url + "/api/admin/store", changes, admin.cookie, "PUT"))
      .status,
    409,
  );
});

test("merchant-issued shopper recovery is single use and revokes existing sessions", async () => {
  const signup = await req(store.url + "/api/retail/register", {
    name: "Recovery customer",
    email: "recovery@example.test",
    password: "before-recovery-123",
  });
  const admin = await req(store.url + "/api/admin/login", {
    password: "long-private-password",
  });
  assert.equal(
    (
      await req(
        store.url + `/api/admin/customers/${signup.data.customer.id}/recovery`,
        {},
      )
    ).status,
    401,
  );
  const issued = await req(
    store.url + `/api/admin/customers/${signup.data.customer.id}/recovery`,
    {},
    admin.cookie,
  );
  const token = new URL(issued.data.url, base).searchParams.get("recover");
  const reset = { token, password: "after-recovery-123" };
  assert.equal(
    (await req(store.url + "/api/retail/recover", reset)).status,
    200,
  );
  assert.equal(
    (await req(store.url + "/api/retail/recover", reset)).status,
    400,
  );
  assert.equal(
    (await req(store.url + "/api/retail/session", null, signup.cookie)).data
      .customer,
    null,
  );
  assert.equal(
    (
      await req(store.url + "/api/retail/login", {
        email: "recovery@example.test",
        password: reset.password,
      })
    ).status,
    200,
  );
});
test("merchant payment credentials are private and unsigned callbacks cannot change orders", async () => {
  assert.equal((await req(store.url + "/api/admin/payments")).status, 401);
  assert.equal(
    (
      await req(store.url + "/api/payments/webhook", {
        obj: { id: 1, success: true },
      })
    ).status,
    403,
  );
  assert.deepEqual((await req(store.url + "/api/payments")).data.methods, [
    "cod",
  ]);
});
test("a real order appears in its shopper account and only delivered purchases can submit reviews and returns", async () => {
  tenant.inTenant(store.id, store.url, () => {
    const p = formDemoProducts[0];
    db.stmt("INSERT INTO products(id,data,position) VALUES(?,?,?)").run(
      p.id,
      JSON.stringify(p),
      0,
    );
    db.indexProductVariants(p);
  });
  const login = await req(store.url + "/api/retail/login", {
    email: "shopper@example.test",
    password: "private-password-123",
  });
  const order = await req(
    store.url + "/api/orders",
    {
      idempotency_key: "retail-order-test-12345",
      payment_method: "cod",
      customer: {
        name: "Shopper",
        phone: "0123456789",
        email: "shopper@example.test",
        address: "Test address",
        city: "Cairo",
        country: "Egypt",
      },
      items: [{ variant_id: "form-jacket-default", quantity: 1 }],
    },
    login.cookie,
  );
  assert.equal(order.status, 201, JSON.stringify(order.data));
  const merchant = await req(store.url + "/api/admin/login", {
    password: "long-private-password",
  });
  assert.equal(
    (await req(store.url + "/api/admin/analytics", null, merchant.cookie)).data
      .orders,
    1,
  );
  assert.equal(
    (await req(store.url + "/api/retail/orders", null, login.cookie)).data
      .orders.length,
    1,
  );
  assert.equal(
    (
      await req(
        store.url + "/api/retail/reviews",
        {
          orderId: order.data.order.id,
          productId: "form-jacket",
          rating: 5,
          body: "Purchased review",
        },
        login.cookie,
      )
    ).status,
    403,
  );
  tenant.inTenant(store.id, store.url, () =>
    db
      .stmt("UPDATE orders SET status='delivered' WHERE id=?")
      .run(order.data.order.id),
  );
  assert.equal(
    (
      await req(
        store.url + "/api/retail/reviews",
        {
          orderId: order.data.order.id,
          productId: "form-jacket",
          rating: 5,
          body: "Purchased review",
        },
        login.cookie,
      )
    ).status,
    201,
  );
  assert.equal(
    (await req(store.url + "/api/retail/reviews/form-jacket")).data.reviews
      .length,
    0,
  );
  assert.equal(
    (
      await req(
        store.url + "/api/retail/returns",
        {
          orderId: order.data.order.id,
          reason: "Exchange size",
          type: "exchange",
        },
        login.cookie,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await req(
        store.url + "/api/retail/returns",
        {
          orderId: order.data.order.id,
          reason: "Another request",
          type: "return",
        },
        login.cookie,
      )
    ).status,
    409,
  );
});
test("online checkout reserves once, rejects canonical amount mismatches, and only a verified provider payment becomes paid", async () => {
  const originalFetch = globalThis.fetch;
  process.env.PUBLIC_URL = "https://vera.example.test";
  let reference, canonical;
  const credentials = {
    enabled: true,
    publicKey: "pk_test_example",
    integrationId: "123",
    secretKey: "sk_test_example",
    apiKey: "test-api-key",
    hmacSecret: "test-hmac-secret",
  };
  const admin = await req(store.url + "/api/admin/login", {
    password: "long-private-password",
  });
  assert.equal(
    (
      await req(
        store.url + "/api/admin/payments",
        credentials,
        admin.cookie,
        "PUT",
      )
    ).status,
    200,
  );
  const publicConfig = (
    await req(store.url + "/api/admin/payments", null, admin.cookie)
  ).data;
  assert.equal(publicConfig.secretKey, undefined);
  assert.equal(publicConfig.apiKey, undefined);
  globalThis.fetch = async (url, options) => {
    const address = String(url);
    if (!address.startsWith("https://accept.paymob.com"))
      return originalFetch(url, options);
    if (address.endsWith("/v1/intention/")) {
      const body = JSON.parse(options.body);
      reference = body.special_reference;
      assert.equal(body.amount, 8900);
      return Response.json({
        client_secret: "test-client-secret",
        intention_order_id: 400,
      });
    }
    if (address.endsWith("/api/auth/tokens"))
      return Response.json({ token: "test-token" });
    return Response.json(canonical);
  };
  try {
    const body = {
      idempotency_key: "online-test-order-key-1234",
      payment_method: "paymob",
      customer: {
        name: "Shopper Test",
        phone: "0123456789",
        email: "shopper@example.test",
        address: "Test address",
        city: "Cairo",
        country: "EG",
      },
      items: [{ variant_id: "form-jacket-default", quantity: 1 }],
    };
    const order = await req(store.url + "/api/orders", body);
    assert.equal(order.status, 201, JSON.stringify(order.data));
    assert.equal(order.data.order.payment_status, "pending");
    assert.match(order.data.payment_url, /accept.paymob.com\/unifiedcheckout/);
    const stock = tenant.inTenant(
      store.id,
      store.url,
      () => db.productById("form-jacket").variants[0].inventory_quantity,
    );
    assert.equal(
      (await req(store.url + "/api/orders", body)).data.order.id,
      order.data.order.id,
    );
    assert.equal(
      tenant.inTenant(
        store.id,
        store.url,
        () => db.productById("form-jacket").variants[0].inventory_quantity,
      ),
      stock,
    );
    canonical = {
      id: 501,
      amount_cents: 8900,
      created_at: "2026-10-08",
      currency: "USD",
      error_occured: false,
      has_parent_transaction: false,
      integration_id: 123,
      is_3d_secure: true,
      is_auth: false,
      is_capture: false,
      is_refunded: false,
      is_standalone_payment: true,
      is_voided: false,
      order: { id: 400, merchant_order_id: reference },
      owner: 2,
      pending: false,
      source_data: { pan: "2345", sub_type: "Visa", type: "card" },
      success: true,
    };
    const fields = [
      "amount_cents",
      "created_at",
      "currency",
      "error_occured",
      "has_parent_transaction",
      "id",
      "integration_id",
      "is_3d_secure",
      "is_auth",
      "is_capture",
      "is_refunded",
      "is_standalone_payment",
      "is_voided",
      "order.id",
      "owner",
      "pending",
      "source_data.pan",
      "source_data.sub_type",
      "source_data.type",
      "success",
    ];
    const signature = createHmac("sha512", credentials.hmacSecret)
      .update(
        fields
          .map((k) =>
            String(k.split(".").reduce((o, key) => o?.[key], canonical)),
          )
          .join(""),
      )
      .digest("hex");
    const callback = { obj: structuredClone(canonical) };
    canonical.amount_cents = 1;
    assert.equal(
      (
        await req(
          store.url + "/api/payments/webhook?hmac=" + signature,
          callback,
        )
      ).status,
      409,
    );
    canonical.amount_cents = 8900;
    assert.equal(
      (
        await req(
          store.url + "/api/payments/webhook?hmac=" + signature,
          callback,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await req(
          store.url + "/api/payments/webhook?hmac=" + signature,
          callback,
        )
      ).status,
      200,
    );
    assert.equal(
      (await req(store.url + "/api/receipt/" + order.data.receipt_token)).data
        .payment_status,
      "paid",
    );
    assert.equal(
      tenant.inTenant(
        store.id,
        store.url,
        () => db.productById("form-jacket").variants[0].inventory_quantity,
      ),
      stock,
    );
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.PUBLIC_URL;
  }
});
