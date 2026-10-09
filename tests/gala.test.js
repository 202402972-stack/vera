import { publishFixture } from "./helpers/merchant-fixture.js";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { galaDefaults, galaProducts } from "../src/data/gala.js";
process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "vera-gala-test-"));
process.env.NODE_ENV = "test";
process.env.PLATFORM_MODE = "1";
let server, base, core, db, inTenant, shop, other, cookie;
const password = "Gala-private-test-password-123";
async function request(url, method = "GET", body, auth = cookie) {
  const r = await fetch(base + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { cookie: auth } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  return { status: r.status, data, headers: r.headers };
}
before(async () => {
  const { app } = await import("../server/platform/app.js");
  core = await import("../server/platform/core.js");
  db = await import("../server/db.js");
  ({ inTenant } = await import("../server/tenant.js"));
  core
    .sql("INSERT INTO platform_users(sub,email,name,created) VALUES(?,?,?,?)")
    .run("gala", "gala@test.example", "GALA", Date.now());
  const u = core.sql("SELECT * FROM platform_users WHERE sub=?").get("gala");
  shop = core.provision(u, {
    name: "Gala tests",
    slug: "gala-tests",
    template: "gala",
    password,
  });
  other = core.provision(u, {
    name: "Other",
    slug: "gala-other",
    template: "gala",
    password,
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
  publishFixture(core, db, { inTenant }, shop);
  publishFixture(core, db, { inTenant }, other);
  const login = await request(shop.url + "/api/admin/login", "POST", {
    password,
  });
  cookie = login.headers.get("set-cookie").split(";")[0];
});
after(async () => {
  await new Promise((r) => server.close(r));
  db.rawDb.close();
  rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});
test("GALA is first, preview has reference catalogue, merchant starts without sample products or testimonials", async () => {
  assert.equal(core.templates[0].id, "gala");
  const demo = await request("/demo/gala/api/products?limit=100");
  assert.equal(demo.data.products.length, 8);
  assert.equal(
    (await request(shop.url + "/api/products")).data.products.length,
    0,
  );
  const store = (await request(shop.url + "/api/store")).data;
  assert.equal(store._template.renderer, "gala");
  assert.deepEqual(store.gala.testimonials, []);
  assert.equal(
    (
      await request("/demo/gala/api/newsletter", "POST", {
        email: "x@test.example",
        consent: true,
      })
    ).status,
    403,
  );
});
test("GALA settings persist, optimistic concurrency protects newer changes, malformed nested settings return 400", async () => {
  const original = (await request(shop.url + "/api/admin/store")).data;
  const edited = structuredClone(original);
  edited.gala.palette.accent = "#987654";
  edited.gala.sections.reverse();
  const save = await request(shop.url + "/api/admin/store", "PUT", edited);
  assert.equal(save.status, 200, JSON.stringify(save.data));
  assert.equal(save.data.gala.palette.accent, "#987654");
  assert.equal(
    (await request(shop.url + "/api/admin/store", "PUT", original)).status,
    409,
  );
  for (const [key, value] of [
    ["hero", null],
    ["currency", { enabled: true, codes: "USD" }],
    ["sections", []],
    ["palette", {}],
    [
      "navigation",
      [{ label: { en: "X", ar: "س" }, path: "javascript:alert(1)", menu: "" }],
    ],
    [
      "testimonials",
      [
        {
          name: "A",
          title: { en: "", ar: "" },
          body: { en: "", ar: "" },
          rating: 6,
        },
      ],
    ],
  ]) {
    const x = structuredClone(save.data);
    x.gala[key] = value;
    assert.equal(
      (await request(shop.url + "/api/admin/store", "PUT", x)).status,
      400,
      key,
    );
  }
});
test("reference product option values, SKU and merchandising survive save and reject malformed options", async () => {
  const p = structuredClone(galaProducts[0]);
  const result = await request(shop.url + "/api/admin/products", "POST", p);
  assert.equal(result.status, 201, JSON.stringify(result.data));
  const stored = (await request(shop.url + "/api/products/" + p.id)).data;
  assert.deepEqual(stored.variants[0].optionValues, p.variants[0].optionValues);
  assert.deepEqual(stored.merchandising, p.merchandising);
  const admin = (await request(shop.url + "/api/admin/products/" + p.id)).data;
  admin.variants[0].optionValues = [null];
  assert.equal(
    (await request(shop.url + "/api/admin/products/" + p.id, "PUT", admin))
      .status,
    400,
  );
});
test("newsletter consent, idempotent subscriptions and message inbox are tenant isolated and require admin", async () => {
  const root = shop.url + "/api";
  assert.equal(
    (
      await request(root + "/newsletter", "POST", {
        email: "reader@test.example",
      })
    ).status,
    400,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await request(root + "/newsletter", "POST", {
          email: "reader@test.example",
          consent: true,
        })
      ).status,
      200,
    );
  assert.equal(
    (await request(root + "/admin/newsletter")).data.subscribers.length,
    1,
  );
  assert.equal(
    (await request(root + "/admin/newsletter", "GET", undefined, "")).status,
    401,
  );
  assert.equal(
    (
      await request(root + "/contact", "POST", {
        name: "Reader",
        email: "reader@test.example",
        body: "Please help with sizing.",
      })
    ).status,
    201,
  );
  const messages = (await request(root + "/admin/messages")).data.messages;
  assert.equal(messages.length, 1);
  assert.equal(
    (
      await request(root + "/admin/messages/" + messages[0].id, "PATCH", {
        status: "resolved",
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(root + "/admin/messages")).data.messages[0].status,
    "resolved",
  );
  inTenant(other.id, other.url, () => {
    assert.equal(db.stmt("SELECT COUNT(*) n FROM gala_messages").get().n, 0);
    assert.equal(db.stmt("SELECT COUNT(*) n FROM subscribers").get().n, 0);
  });
});
test("collection availability and price filters use actual variant stock, not product display labels", async () => {
  const p = structuredClone(galaProducts[1]);
  p.variants.forEach((v) => (v.inventory_quantity = 0));
  assert.equal(
    (await request(shop.url + "/api/admin/products", "POST", p)).status,
    201,
  );
  const out = await request(shop.url + "/api/products?in_stock=0");
  assert.deepEqual(
    out.data.products.map((p) => p.id),
    [p.id],
  );
  const avail = await request(shop.url + "/api/products?in_stock=1");
  assert.ok(avail.data.products.every((p) => p.id !== galaProducts[1].id));
  assert.equal(
    (await request(shop.url + "/api/products?rating=9")).status,
    400,
  );
  assert.equal(
    (await request(shop.url + "/api/products?max_price=0")).data.total,
    0,
  );
  const sorted = (await request(shop.url + "/api/products?sort=name-asc")).data
    .products;
  assert.equal(sorted[0].title, "Silk Midi Dress");
});
test("Atelier image migration is idempotent and preserves custom photos and all other product data", async () => {
  const { catalogue, atelierOriginalImages } =
    await import("../src/data/products.js");
  const { migrateAtelierImages } = await import("../server/atelier-images.js");
  inTenant(other.id, other.url, () => {
    const p = structuredClone(catalogue[0]);
    p.image = atelierOriginalImages[p.id];
    p.images = [{ url: p.image }, { url: "/assets/custom.jpg" }];
    p.variants[0].image_url = "/assets/custom.jpg";
    db.stmt("INSERT INTO products(id,data,position) VALUES(?,?,?)").run(
      p.id,
      JSON.stringify(p),
      0,
    );
    db.indexProductVariants(p);
    const before = db.productById(p.id);
    migrateAtelierImages();
    const after = db.productById(p.id);
    assert.equal(after.image, "/assets/atelier-alpaca-scarf.jpg");
    assert.equal(after.images[1].url, "/assets/custom.jpg");
    assert.equal(after.variants[0].image_url, "/assets/custom.jpg");
    for (const key of ["title", "description", "variants", "additional_info"])
      assert.deepEqual(after[key], before[key]);
    migrateAtelierImages();
    assert.deepEqual(db.productById(p.id), after);
  });
});

test("review photos stay private until moderation; only the purchaser can attach their own uploads and hide their display name", async () => {
  const signup = await request(
    shop.url + "/api/retail/register",
    "POST",
    {
      name: "Private customer",
      email: "private-review@test.example",
      password: "private-shopper-password-123",
    },
    "",
  );
  assert.equal(signup.status, 201);
  const shopperCookie = signup.headers.get("set-cookie").split(";")[0];
  const sharp = (await import("sharp")).default;
  const image = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#ffffff" },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.set("image", new Blob([image], { type: "image/png" }), "photo.png");
  const uploaded = await fetch(base + shop.url + "/api/retail/review-image", {
    method: "POST",
    headers: { cookie: shopperCookie },
    body: form,
  });
  assert.equal(uploaded.status, 201);
  const { id } = await uploaded.json();
  const imageUrl = base + shop.url + "/api/retail/review-image/" + id;
  assert.equal((await fetch(imageUrl)).status, 404);
  assert.equal(
    (await fetch(imageUrl, { headers: { cookie: shopperCookie } })).status,
    200,
  );
  assert.equal(
    (
      await fetch(base + other.url + "/api/retail/review-image/" + id, {
        headers: { cookie: shopperCookie },
      })
    ).status,
    404,
  );
  const order = await request(
    shop.url + "/api/orders",
    "POST",
    {
      idempotency_key: "gala-review-order-123456",
      payment_method: "cod",
      customer: {
        name: "Private customer",
        email: "private-review@test.example",
        phone: "01234567890",
        address: "Test Street 10",
        city: "Cairo",
        country: "Egypt",
      },
      items: [{ variant_id: galaProducts[0].variants[0].id, quantity: 1 }],
    },
    shopperCookie,
  );
  assert.equal(order.status, 201, JSON.stringify(order.data));
  const review = {
    orderId: order.data.order.id,
    productId: galaProducts[0].id,
    rating: 5,
    body: "Purchased and photographed",
    title: "A good fit",
    displayName: "Initials",
    privateName: true,
    images: [id],
  };
  assert.equal(
    (
      await request(
        shop.url + "/api/retail/reviews",
        "POST",
        review,
        shopperCookie,
      )
    ).status,
    403,
  );
  inTenant(shop.id, shop.url, () =>
    db
      .stmt("UPDATE orders SET status='delivered' WHERE id=?")
      .run(order.data.order.id),
  );
  assert.equal(
    (
      await request(
        shop.url + "/api/retail/reviews",
        "POST",
        { ...review, images: ["unknown-image"] },
        shopperCookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        shop.url + "/api/retail/reviews",
        "POST",
        review,
        shopperCookie,
      )
    ).status,
    201,
  );
  const moderator = await request(shop.url + "/api/admin/reviews");
  assert.equal(moderator.data.reviews.length, 1);
  const saved = moderator.data.reviews[0];
  assert.equal(JSON.parse(saved.metadata).title, "A good fit");
  assert.equal(
    (
      await fetch(base + shop.url + "/api/admin/review-image/" + id, {
        headers: { cookie },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(shop.url + "/api/retail/reviews/" + galaProducts[0].id)).data
      .reviews.length,
    0,
  );
  await request(shop.url + "/api/admin/reviews/" + saved.id, "PATCH", {
    status: "approved",
  });
  const publicReviews = (
    await request(shop.url + "/api/retail/reviews/" + galaProducts[0].id)
  ).data.reviews;
  assert.equal(publicReviews[0].name, "Anonymous");
  assert.equal(publicReviews[0].title, "A good fit");
  assert.deepEqual(publicReviews[0].images, [id]);
  assert.equal((await fetch(imageUrl)).status, 200);
  assert.equal(
    (await request(shop.url + "/api/products?rating=5")).data.total,
    1,
  );
  await request(shop.url + "/api/admin/reviews/" + saved.id, "PATCH", {
    status: "rejected",
  });
  assert.equal((await fetch(imageUrl)).status, 404);
});
