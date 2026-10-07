import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
const temporary = mkdtempSync(path.join(os.tmpdir(), "boutique-test-"));
process.env.DATA_DIR = temporary;
process.env.NODE_ENV = "test";
delete process.env.ADMIN_PASSWORD;
let app, db, store, telegram, server, base, cookie, receipt, createdOrder;
const realFetch = globalThis.fetch;
async function request(
  route,
  { method = "GET", body, admin = false, headers = {} } = {},
) {
  const response = await realFetch(`${base}/api${route}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(admin ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    headers: response.headers,
    data: response.status === 204 ? null : await response.json(),
  };
}
const customer = {
  name: "Test Customer",
  phone: "+1 555 123 4567",
  email: "test@example.com",
  address: "12 Test Street, Unit 4",
  city: "Portland",
  region: "Oregon",
  postalCode: "97201",
  country: "United States",
  location: "https://maps.google.com/?q=Portland",
  notes: "Ring the bell.",
};
const orderBody = (variant = "alpaca-scarf-grey", quantity = 2) => ({
  idempotency_key: randomUUID(),
  payment_method: "cod",
  items: [{ variant_id: variant, quantity }],
  customer,
});
before(async () => {
  ({ app } = await import("../server/index.js"));
  ({ db } = await import("../server/db.js"));
  telegram = await import("../server/telegram.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  globalThis.fetch = realFetch;
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(temporary, { recursive: true, force: true });
});

test("original catalogue and copy are seeded unchanged; public endpoints do not expose secrets", async () => {
  const { catalogue } = await import("../src/data/products.js");
  const { defaultSettings } = await import("../src/data/settings.js");
  const response = await request("/products");
  assert.equal(response.status, 200);
  assert.equal(response.data.total, 4);
  for (const product of response.data.products) {
    const original = catalogue.find((p) => p.id === product.id);
    for (const key of Object.keys(original))
      assert.deepEqual(product[key], original[key]);
  }
  const settings = await request("/store");
  assert.deepEqual(settings.data, defaultSettings);
  store = settings.data;
  assert.equal(settings.data.telegram, undefined);
  assert.equal((await request("/admin/orders")).status, 401);
  assert.equal((await request("/admin/export")).status, 401);
});
test("password authentication, HttpOnly cookie, wrong password and cross-site protection", async () => {
  assert.equal(
    (
      await request("/admin/login", {
        method: "POST",
        body: { password: "incorrect" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/admin/login", {
        method: "POST",
        body: { password: "admin@admin" },
        headers: { Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  const login = await request("/admin/login", {
    method: "POST",
    body: { password: "admin@admin" },
  });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie"), /HttpOnly/);
  assert.match(login.headers.get("set-cookie"), /SameSite=Strict/);
  cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (await request("/admin/session", { admin: true })).data.defaultPassword,
    true,
  );
});
test("content updates survive another process and currency applies to products", async () => {
  store = (await request("/admin/store", { admin: true })).data;
  const updated = {
    ...store,
    name: "Test Boutique",
    hero: { ...store.hero, title: "A soft new beginning" },
    checkout: { ...store.checkout, shippingInCents: 500 },
  };
  assert.equal(
    (
      await request("/admin/store", {
        method: "PUT",
        admin: true,
        body: updated,
      })
    ).status,
    200,
  );
  assert.equal((await request("/store")).data.name, "Test Boutique");
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import {getSetting,db} from './server/db.js';console.log(getSetting('store').name);db.close();",
    ],
    { cwd: process.cwd(), env: { ...process.env, DATA_DIR: temporary } },
  ).toString();
  assert.match(output, /Test Boutique/);
});
test("content validation rejects unsafe links and invalid hero images", async () => {
  const updated = (await request("/store")).data;
  assert.equal(
    (
      await request("/admin/store", {
        method: "PUT",
        admin: true,
        body: {
          ...updated,
          footer: {
            ...updated.footer,
            socials: [{ label: "Bad", path: "javascript:alert(1)" }],
          },
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/admin/store", {
        method: "PUT",
        admin: true,
        body: {
          ...updated,
          hero: { ...updated.hero, image: "https://internal.example/image" },
        },
      })
    ).status,
    400,
  );
});
test("product CRUD, sanitation, draft filtering, duplicate style rejection and reorder", async () => {
  const source = (await request("/admin/products", { admin: true })).data
    .products[0];
  const product = {
    ...source,
    id: "test-product",
    title: "Test product",
    status: "draft",
    description:
      "<p>Safe <strong>copy</strong></p><script>alert(1)</script><img src=x onerror=alert(1)>",
    variants: [
      {
        ...source.variants[0],
        id: "test-product-style",
        inventory_quantity: 1,
      },
    ],
  };
  const saved = await request("/admin/products", {
    method: "POST",
    admin: true,
    body: product,
  });
  assert.equal(saved.status, 201);
  assert.equal(saved.data.description, "<p>Safe <strong>copy</strong></p>");
  assert.equal((await request("/products/test-product")).status, 404);
  assert.equal(
    (
      await request("/admin/products", {
        method: "POST",
        admin: true,
        body: { ...product, id: "test-duplicate" },
      })
    ).status,
    400,
  );
  product.status = "published";
  product._version = saved.data._version;
  assert.equal(
    (
      await request("/admin/products/test-product", {
        method: "PUT",
        admin: true,
        body: product,
      })
    ).status,
    200,
  );
  assert.equal((await request("/products/test-product")).status, 200);
  const all = (await request("/admin/products", { admin: true })).data.products;
  assert.equal(
    (
      await request("/admin/product-order", {
        method: "PUT",
        admin: true,
        body: { ids: all.map((p) => p.id).reverse() },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/products")).data.products[0].id,
    "test-product",
  );
});
test("image uploads are optimized to the exact storefront dimensions", async () => {
  const bytes = await sharp({
    create: { width: 400, height: 200, channels: 3, background: "#b89f86" },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.set("kind", "product");
  form.set("image", new Blob([bytes], { type: "image/png" }), "test.png");
  const response = await realFetch(`${base}/api/admin/upload`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  const data = await response.json();
  assert.equal(response.status, 201);
  assert.equal(data.width, 800);
  assert.equal(data.height, 1000);
  const image = await realFetch(`${base}${data.url}`);
  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type"), /webp/);
  const meta = await sharp(Buffer.from(await image.arrayBuffer())).metadata();
  assert.equal(meta.width, 800);
  assert.equal(meta.height, 1000);
});
test("checkout recalculates sale prices and shipping, snapshots customer and product details, decrements inventory", async () => {
  const body = {
    ...orderBody(),
    total_in_cents: 1,
    items: [
      { variant_id: "alpaca-scarf-grey", quantity: 2, price_in_cents: 1 },
    ],
  };
  const result = await request("/orders", { method: "POST", body });
  assert.equal(result.status, 201);
  assert.equal(result.data.order.subtotal_in_cents, 10400);
  assert.equal(result.data.order.shipping_in_cents, 500);
  assert.equal(result.data.order.total_in_cents, 10900);
  assert.deepEqual(result.data.order.customer, customer);
  assert.equal(result.data.order.items[0].title, "Alpaca Wool Scarf");
  assert.equal(result.data.order.items[0].additional_info.length, 2);
  receipt = result.data.receipt_token;
  createdOrder = result.data.order;
  assert.equal(
    (await request("/products/alpaca-scarf")).data.variants.find(
      (v) => v.id === "alpaca-scarf-grey",
    ).inventory_quantity,
    6,
  );
  const again = await request("/orders", { method: "POST", body });
  assert.equal(again.status, 200);
  assert.equal(again.data.order.number, result.data.order.number);
  assert.equal(
    (await request("/products/alpaca-scarf")).data.variants.find(
      (v) => v.id === "alpaca-scarf-grey",
    ).inventory_quantity,
    6,
  );
});
test("receipt tokens isolate customer details; card payments and invalid delivery details are rejected", async () => {
  const received = await request(`/receipt/${receipt}`);
  assert.equal(received.data.number, createdOrder.number);
  assert.equal(received.data.telegram_error, undefined);
  assert.equal((await request("/receipt/not-a-receipt")).status, 404);
  assert.equal(
    (
      await request("/orders", {
        method: "POST",
        body: { ...orderBody(), payment_method: "card" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/orders", {
        method: "POST",
        body: { ...orderBody(), customer: { ...customer, phone: "invalid" } },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/orders", {
        method: "POST",
        body: {
          ...orderBody(),
          items: [{ variant_id: "alpaca-scarf-grey", quantity: -1 }],
        },
      })
    ).status,
    400,
  );
});
test("concurrent orders cannot oversell; failed orders do not partially decrement stock", async () => {
  const results = await Promise.all([
    request("/orders", {
      method: "POST",
      body: orderBody("test-product-style", 1),
    }),
    request("/orders", {
      method: "POST",
      body: orderBody("test-product-style", 1),
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const stockBefore = (await request("/products/alpaca-scarf")).data.variants[0]
    .inventory_quantity;
  const failure = await request("/orders", {
    method: "POST",
    body: {
      ...orderBody(),
      items: [
        { variant_id: "alpaca-scarf-cream", quantity: 1 },
        { variant_id: "alpaca-gloves-l", quantity: 1 },
      ],
    },
  });
  assert.equal(failure.status, 409);
  assert.equal(
    (await request("/products/alpaca-scarf")).data.variants[0]
      .inventory_quantity,
    stockBefore,
  );
});
test("orders are searchable and cancellation restores stock once; old snapshots survive product deletion", async () => {
  const orders = await request("/admin/orders?search=Test%20Customer", {
    admin: true,
  });
  assert.equal(orders.data.total, 2);
  const cancel = () =>
    request(`/admin/orders/${createdOrder.id}`, {
      method: "PATCH",
      admin: true,
      body: { status: "cancelled" },
    });
  assert.equal((await cancel()).status, 200);
  assert.equal((await cancel()).status, 200);
  assert.equal(
    (await request("/products/alpaca-scarf")).data.variants.find(
      (v) => v.id === "alpaca-scarf-grey",
    ).inventory_quantity,
    8,
  );
  assert.equal(
    (
      await request(`/admin/orders/${createdOrder.id}`, {
        method: "PATCH",
        admin: true,
        body: { status: "new" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/admin/products/test-product", {
        method: "DELETE",
        admin: true,
      })
    ).status,
    200,
  );
  const snapshot = (
    await request("/admin/orders", { admin: true })
  ).data.orders.find((o) => o.items[0].product_id === "test-product");
  assert.equal(snapshot.items[0].title, "Test product");
});
test("first-party analytics records entries, exits, devices, funnel and actions; DNT is respected", async () => {
  const session = randomUUID(),
    visitor = randomUUID();
  const payload = {
    session,
    visitor,
    referrer: "https://example.com/campaign",
    source: "newsletter",
    campaign: "winter",
    duration: 22000,
    events: [
      { type: "page_view", path: "/" },
      { type: "page_view", path: "/product/alpaca-scarf" },
      {
        type: "add_to_cart",
        path: "/product/alpaca-scarf",
        label: "alpaca-scarf",
      },
      { type: "checkout_start", path: "/checkout" },
      { type: "order_created", path: "/success", label: createdOrder.number },
    ],
  };
  assert.equal(
    (await request("/analytics", { method: "POST", body: payload })).status,
    204,
  );
  assert.equal(
    (
      await request("/analytics", {
        method: "POST",
        body: { ...payload, session: randomUUID(), visitor: randomUUID() },
        headers: { DNT: "1" },
      })
    ).status,
    204,
  );
  const report = (await request("/admin/analytics", { admin: true })).data;
  assert.equal(report.visitors, 1);
  assert.equal(report.sessions, 1);
  assert.equal(report.pageviews, 2);
  assert.equal(report.entries[0].label, "/");
  assert.equal(report.exits[0].label, "/success");
  assert.equal(report.referrers[0].label, "example.com");
  assert.equal(report.funnel.at(-1).count, 0);
  assert.equal(report.recent[0].journey.length, 5);
});
test("Telegram token is encrypted and never returned; short orders use one image notification", async () => {
  const fakeToken = "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ123456";
  const calls = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://api.telegram.org/")) {
      calls.push({ url, body: options.body });
      return new Response(
        JSON.stringify({ ok: true, result: { message_id: 1 } }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    return realFetch(url, options);
  };

  assert.equal(
    (
      await request("/admin/telegram", {
        method: "PUT",
        admin: true,
        body: { token: fakeToken, chatId: "123456789" },
      })
    ).status,
    200,
  );
  const config = await request("/admin/telegram", { admin: true });
  assert.equal(config.data.hasToken, true);
  assert.equal(config.data.token, undefined);
  const encrypted = db
    .prepare("SELECT value FROM settings WHERE key='telegram'")
    .get().value;
  assert.ok(!encrypted.includes(fakeToken));
  await telegram.deliverPending();
  for (
    let i = 0;
    i < 150 &&
    db
      .prepare(
        "SELECT COUNT(*) count FROM orders WHERE telegram_status!='sent'",
      )
      .get().count;
    i++
  )
    await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(calls.length > 0);
  const first = calls.find((c) => String(c.url).endsWith("/sendPhoto"));
  assert.ok(first);
  assert.match(first.body.get("caption"), /ORD-/);
  assert.match(first.body.get("caption"), /Test Customer/);
  assert.ok(first.body.get("photo").size > 0);
  assert.equal(
    (await request("/admin/orders", { admin: true })).data.orders.every(
      (o) => o.telegram_status === "sent",
    ),
    true,
  );
});
test("long Telegram orders use one photo receipt containing images and complete delivery details", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://api.telegram.org/")) {
      calls.push({ url, body: options.body });
      return new Response(
        JSON.stringify({ ok: true, result: { message_id: 2 } }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    return realFetch(url, options);
  };
  const result = await request("/orders", {
    method: "POST",
    body: {
      ...orderBody("alpaca-beanie-oat", 1),
      customer: {
        ...customer,
        notes: "Long delivery instructions. ".repeat(30),
      },
    },
  });
  assert.equal(result.status, 201);
  // The queue may already be running from the checkout handler.
  for (let i = 0; i < 100 && !calls.length; i++)
    await new Promise((resolve) => setTimeout(resolve, 20));
  const call = calls.find((c) => String(c.url).endsWith("/sendPhoto"));
  assert.ok(call);
  assert.equal(calls.length, 1);
  const photo = Buffer.from(await call.body.get("photo").arrayBuffer());
  const meta = await sharp(photo).metadata();
  assert.equal(meta.format, "jpeg");
  assert.ok(meta.height > meta.width);
  assert.ok(photo.length > 1000);
  assert.match(call.body.get("caption"), /ORD-/);
});
test("Telegram failure is visible, order remains saved, and a later retry succeeds", async () => {
  globalThis.fetch = async (url, options) =>
    String(url).startsWith("https://api.telegram.org/")
      ? new Response(
          JSON.stringify({ ok: false, description: "Bot cannot access chat" }),
        )
      : realFetch(url, options);
  const result = await request("/orders", {
    method: "POST",
    body: orderBody("alpaca-gloves-s", 1),
  });
  assert.equal(result.status, 201);
  for (let i = 0; i < 100; i++) {
    const row = db
      .prepare("SELECT telegram_status FROM orders WHERE id=?")
      .get(result.data.order.id);
    if (row.telegram_status === "failed") break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  let row = db
    .prepare("SELECT * FROM orders WHERE id=?")
    .get(result.data.order.id);
  assert.equal(row.telegram_status, "failed");
  assert.match(row.telegram_error, /cannot access/);
  globalThis.fetch = async (url, options) =>
    String(url).startsWith("https://api.telegram.org/")
      ? new Response(JSON.stringify({ ok: true, result: { message_id: 3 } }))
      : realFetch(url, options);
  db.prepare("UPDATE orders SET telegram_next_attempt=0 WHERE id=?").run(
    row.id,
  );
  await telegram.deliverPending();
  row = db.prepare("SELECT * FROM orders WHERE id=?").get(row.id);
  assert.equal(row.telegram_status, "sent");
  assert.equal(row.telegram_attempts, 2);
});
test("exports are protected and logout revokes the session", async () => {
  assert.equal(
    (await request("/admin/export", { admin: true })).data.format,
    "alpaca-store-v1",
  );
  assert.equal(
    (await request("/admin/logout", { method: "POST", admin: true })).status,
    200,
  );
  assert.equal((await request("/admin/session", { admin: true })).status, 401);
});
