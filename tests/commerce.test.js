import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { brandPresets } from "../src/data/brand.js";
const directory = mkdtempSync(path.join(os.tmpdir(), "boutique-commerce-"));
process.env.DATA_DIR = directory;
process.env.NODE_ENV = "test";
delete process.env.ADMIN_PASSWORD;
let server, db, base, cookie;
const customer = {
  name: "Studio customer",
  phone: "+201234567890",
  address: "12 Studio Lane",
  city: "Cairo",
  country: "Egypt",
};
const items = [{ variant_id: "alpaca-beanie-oat", quantity: 1 }];
async function request(route, method = "GET", body, auth = true) {
  const response = await fetch(base + "/api" + route, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Cookie: cookie || "" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
async function settings(update) {
  const { data } = await request("/admin/store");
  const response = await request("/admin/store", "PUT", update(data));
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return response.data;
}
async function discount(code, overrides = {}) {
  const response = await request("/admin/discounts/" + code, "PUT", {
    code,
    type: "percent",
    value: 10,
    minimumInCents: 0,
    maxUses: null,
    expiresAt: null,
    active: true,
    ...overrides,
  });
  assert.equal(response.status, 200, JSON.stringify(response.data));
}
const order = (extra = {}) => ({
  idempotency_key: randomUUID(),
  customer,
  payment_method: "cod",
  items,
  ...extra,
});
before(async () => {
  const { app } = await import("../server/index.js");
  ({ db } = await import("../server/db.js"));
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  const res = await fetch(base + "/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "admin@admin" }),
  });
  cookie = res.headers.get("set-cookie").split(";")[0];
});
after(async () => {
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(directory, { recursive: true, force: true });
});

test("brand presets preserve accessible contrast, reject injection and detect stale settings", async () => {
  for (const preset of Object.values(brandPresets))
    await settings((s) => ({ ...s, brand: { ...s.brand, ...preset } }));
  const { data: current } = await request("/admin/store");
  assert.equal(
    (
      await request("/admin/store", "PUT", {
        ...current,
        brand: { ...current.brand, foreground: current.brand.background },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/admin/store", "PUT", {
        ...current,
        brand: {
          ...current.brand,
          primary: "red; background:url(https://evil.test)",
        },
      })
    ).status,
    400,
  );
  await settings((s) => ({
    ...s,
    brand: {
      ...s.brand,
      ...brandPresets.atelier,
      announcement: {
        enabled: true,
        text: "Your atelier",
        textAr: "أتيليه خاص بك",
        link: "/shop",
      },
    },
  }));
  assert.equal((await request("/admin/store", "PUT", current)).status, 409);
  const { data: store } = await request("/store");
  assert.equal(store.brand.announcement.textAr, "أتيليه خاص بك");
});
test("server quotes ignore client prices and consistently apply discounts, shipping and exclusive tax", async () => {
  await settings((s) => ({
    ...s,
    checkout: { ...s.checkout, shippingInCents: 500 },
    commerce: {
      ...s.commerce,
      freeShippingOverInCents: 3500,
      taxRateBps: 1400,
      allowedCountries: ["Egypt"],
    },
  }));
  await discount("WELCOME");
  const quote = await request("/checkout/quote", "POST", {
    items,
    coupon_code: "welcome",
    country: "Egypt",
    total_in_cents: 1,
  });
  assert.equal(quote.status, 200);
  assert.equal(quote.data.subtotal_in_cents, 3800);
  assert.equal(quote.data.discount_in_cents, 380);
  assert.equal(quote.data.shipping_in_cents, 500);
  assert.equal(quote.data.tax_in_cents, 479);
  assert.equal(quote.data.total_in_cents, 4399);
  const body = order({ coupon_code: "welcome", total_in_cents: 1 });
  const placed = await request("/orders", "POST", body);
  assert.equal(placed.status, 201);
  for (const key of [
    "subtotal_in_cents",
    "discount_in_cents",
    "shipping_in_cents",
    "tax_in_cents",
    "total_in_cents",
  ])
    assert.equal(placed.data.order[key], quote.data[key]);
  const retry = await request("/orders", "POST", body);
  assert.equal(retry.data.order.id, placed.data.order.id);
  assert.equal(
    db.prepare("SELECT used FROM discounts WHERE code=?").get("WELCOME").used,
    1,
  );
});
test("last coupon redemption is atomic with stock and failed orders roll back", async () => {
  await discount("LASTONE", { maxUses: 1 });
  const before = JSON.parse(
    db.prepare("SELECT data FROM products WHERE id='alpaca-beanie'").get().data,
  ).variants[0].inventory_quantity;
  const results = await Promise.all([
    request("/orders", "POST", order({ coupon_code: "LASTONE" })),
    request("/orders", "POST", order({ coupon_code: "LASTONE" })),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
  const after = JSON.parse(
    db.prepare("SELECT data FROM products WHERE id='alpaca-beanie'").get().data,
  ).variants[0].inventory_quantity;
  assert.equal(before - after, 1);
  assert.equal(
    db.prepare("SELECT used FROM discounts WHERE code='LASTONE'").get().used,
    1,
  );
});
test("paused orders, minimums, countries, expired codes and coupon minimums are enforced", async () => {
  await settings((s) => ({
    ...s,
    commerce: { ...s.commerce, acceptingOrders: false },
  }));
  assert.equal((await request("/orders", "POST", order())).status, 409);
  await settings((s) => ({
    ...s,
    commerce: {
      ...s.commerce,
      acceptingOrders: true,
      minimumOrderInCents: 10000,
    },
  }));
  assert.equal((await request("/orders", "POST", order())).status, 400);
  await settings((s) => ({
    ...s,
    commerce: { ...s.commerce, minimumOrderInCents: 0 },
  }));
  assert.equal(
    (
      await request(
        "/orders",
        "POST",
        order({ customer: { ...customer, country: "France" } }),
      )
    ).status,
    400,
  );
  await discount("EXPIRED", { expiresAt: "2020-01-01T00:00:00Z" });
  assert.equal(
    (
      await request("/checkout/quote", "POST", {
        items,
        coupon_code: "EXPIRED",
      })
    ).status,
    400,
  );
  await discount("MINIMUM", { minimumInCents: 10000 });
  assert.equal(
    (
      await request("/checkout/quote", "POST", {
        items,
        coupon_code: "MINIMUM",
      })
    ).status,
    400,
  );
  assert.equal(
    (await request("/checkout/quote", "POST", { items, country: 123 })).status,
    400,
  );
  await discount("FIXED", { type: "fixed", value: 100000 });
  const capped = await request("/checkout/quote", "POST", {
    items,
    coupon_code: "FIXED",
  });
  assert.equal(capped.data.discount_in_cents, 3800);
  assert.equal(capped.data.total_in_cents, 500);
});
test("private discount endpoints enforce auth and optimistic edits", async () => {
  assert.equal(
    (await request("/admin/discounts", "GET", undefined, false)).status,
    401,
  );
  const { data } = await request("/admin/discounts");
  const d = data.discounts.find((d) => d.code === "WELCOME");
  assert.equal(
    (await request("/admin/discounts/WELCOME", "PUT", { ...d, active: false }))
      .status,
    200,
  );
  assert.equal(
    (await request("/admin/discounts/WELCOME", "PUT", d)).status,
    409,
  );
  assert.equal(
    (
      await request("/checkout/quote", "POST", {
        items,
        coupon_code: "WELCOME",
      })
    ).status,
    400,
  );
});
test("catalogue searches both languages, filters categories and sorts prices on the server", async () => {
  const p = (await request("/admin/products/alpaca-beanie")).data;
  assert.equal(
    (
      await request("/admin/products/alpaca-beanie", "PUT", {
        ...p,
        category: "Headwear",
      })
    ).status,
    200,
  );
  const filtered = await request("/products?category=Headwear&search=beanie");
  assert.equal(filtered.data.total, 1);
  assert.equal(filtered.data.products[0].id, p.id);
  assert.equal(
    (await request("/products?search=%D9%82%D8%A8%D8%B9%D8%A9")).data.total,
    1,
  );
  const sorted = await request("/products?sort=price-asc");
  const prices = sorted.data.products.map((p) =>
    Math.min(
      ...p.variants.map((v) => v.sale_price_in_cents ?? v.price_in_cents),
    ),
  );
  assert.deepEqual(
    prices,
    [...prices].sort((a, b) => a - b),
  );
  assert.equal((await request("/products?sort=toString")).status, 200);
  assert.deepEqual((await request("/categories")).data.categories, [
    "Headwear",
  ]);
  const latest = (await request("/products?sort=newest")).data.products[0].id;
  assert.equal(
    (await request(`/admin/products/${latest}/move`, "POST", { direction: -1 }))
      .status,
    200,
  );
  assert.equal(
    (await request("/products?sort=newest")).data.products[0].id,
    latest,
  );
});
test("tracking reaches the private receipt, rejects unsafe links and stale status updates", async () => {
  const placed = (await request("/orders", "POST", order())).data;
  const route = `/admin/orders/${placed.order.id}`;
  const tracking = {
    carrier: "Studio shipping",
    number: "TRACK123",
    url: "https://shipping.example/track/123",
  };
  assert.equal(
    (
      await request(route, "PATCH", {
        status: "shipped",
        expected_status: "new",
        tracking,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(route, "PATCH", {
        status: "processing",
        expected_status: "new",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(route, "PATCH", {
        status: "delivered",
        tracking: { ...tracking, url: "javascript:alert(1)" },
      })
    ).status,
    400,
  );
  const receipt = await request(
    "/receipt/" + placed.receipt_token,
    "GET",
    undefined,
    false,
  );
  assert.equal(receipt.data.status, "shipped");
  assert.deepEqual(receipt.data.tracking, tracking);
  assert.deepEqual(
    receipt.data.history.map((r) => r.status),
    ["new", "shipped"],
  );
  assert.equal((await request("/receipt/" + randomUUID())).status, 404);
});
test("logos retain aspect ratio and public operations remain protected", async () => {
  const bytes = await sharp({
    create: { width: 400, height: 100, channels: 4, background: "#123456" },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.set("image", new Blob([bytes], { type: "image/png" }), "logo.png");
  form.set("kind", "logo");
  const response = await fetch(base + "/api/admin/upload", {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  assert.equal(response.status, 201);
  const image = await response.json();
  const buffer = Buffer.from(
    await (await fetch(base + image.url)).arrayBuffer(),
  );
  const metadata = await sharp(buffer).metadata();
  assert.equal(metadata.width / metadata.height, 4);
  assert.equal(
    (await request("/admin/operations", "GET", undefined, false)).status,
    401,
  );
  assert.equal((await request("/admin/operations")).status, 200);
});
test("unsupported currency scales cannot silently misprice the store", async () => {
  const { data } = await request("/admin/store");
  for (const currency of ["JPY", "KWD", "ZZZ"])
    assert.equal(
      (
        await request("/admin/store", "PUT", {
          ...data,
          checkout: { ...data.checkout, currency },
        })
      ).status,
      400,
    );
});

test("production fails closed without a private admin password", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "boutique-production-"));
  try {
    assert.throws(
      () =>
        execFileSync(process.execPath, ["server/index.js"], {
          env: {
            ...process.env,
            NODE_ENV: "production",
            DATA_DIR: dir,
            ADMIN_PASSWORD: "",
          },
          stdio: "pipe",
          timeout: 10000,
        }),
      (error) => error.stderr.toString().includes("Set ADMIN_PASSWORD"),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("button fill is independently validated, persisted and compatible with older brand settings", async () => {
  const { resolveBrand, defaultBrand } = await import("../src/data/brand.js");
  const { brandTokens, contrast } = await import("../src/lib/brand.js");
  assert.equal(resolveBrand({ primary: "#80623e" }).button, "#c0b095");
  assert.equal(resolveBrand({ primary: "#245749" }).button, "#245749");
  const old = (await request("/admin/store")).data;
  try {
    const saved = await settings((s) => ({
      ...s,
      brand: { ...defaultBrand, button: "#d9bd86" },
    }));
    assert.equal(saved.brand.button, "#d9bd86");
    assert.equal(
      (await request("/store", "GET", undefined, false)).data.brand.button,
      "#d9bd86",
    );
    assert.equal(brandTokens(saved.brand)["--button-background"], "40 52% 69%");
    // Automatic foreground remains readable even for midtone fills.
    for (const fill of ["#000000", "#ffffff", "#888888", "#7b7b7b", "#c0b095"]) {
      const foreground = brandTokens({ button: fill })["--button-foreground"];
      const hex =
        foreground === "0 0% 100%"
          ? "#ffffff"
          : foreground === "0 0% 0%"
            ? "#000000"
            : "#302c27";
      assert.ok(contrast(fill, hex) >= 4.5);
    }
    const invalid = await request("/admin/store", "PUT", {
      ...saved,
      brand: { ...saved.brand, button: "url(javascript:alert(1))" },
    });
    assert.equal(invalid.status, 400);
  } finally {
    await settings((s) => ({ ...old, _version: s._version }));
  }
});

test("direct order details require a session and return stored history without receipt secrets", async () => {
  const placed = await request("/orders", "POST", order());
  assert.equal(placed.status, 201);
  const id = placed.data.order.id;
  assert.equal(
    (await request(`/admin/orders/${id}`, "GET", undefined, false)).status,
    401,
  );
  const result = await request(`/admin/orders/${id}`);
  assert.equal(result.status, 200);
  assert.equal(result.data.number, placed.data.order.number);
  assert.equal(result.data.customer.name, customer.name);
  assert.equal(result.data.history[0].status, "new");
  assert.equal(result.data.receipt_token, undefined);
  assert.equal((await request("/admin/orders/not-an-id")).status, 404);
  assert.equal((await request("/admin/orders/999999999")).status, 404);
});
