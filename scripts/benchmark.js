import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
const temporary = mkdtempSync(path.join(os.tmpdir(), "boutique-benchmark-"));
process.env.DATA_DIR = temporary;
process.env.NODE_ENV = "test";
delete process.env.ADMIN_PASSWORD;
const { db, indexProductVariants, transaction, productsAll } =
  await import("../server/db.js");
const { app } = await import("../server/index.js");
let server;
try {
  const product = productsAll()[0],
    now = new Date().toISOString();
  transaction(() => {
    const insertProduct = db.prepare(
      "INSERT INTO products(id,data,position) VALUES (?,?,?)",
    );
    for (let i = 0; i < 2500; i++) {
      const p = {
        ...product,
        id: `benchmark-${i}`,
        title: `Benchmark product ${i}`,
        variants: [
          {
            ...product.variants[0],
            id: `benchmark-${i}-style`,
            inventory_quantity: 1000,
          },
        ],
      };
      insertProduct.run(p.id, JSON.stringify(p), i + 4);
      indexProductVariants(p);
    }
    const insertVisit = db.prepare(
      "INSERT INTO visits(id,visitor,started_at,last_at,entry,exit,referrer,device,browser,country,duration,pageviews,cart,checkout) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    );
    const insertEvent = db.prepare(
      "INSERT INTO events(event_id,session,at,type,path,label,value) VALUES (?,?,?,?,?,?,?)",
    );
    for (let i = 0; i < 20000; i++) {
      const id = `benchmark-visit-${i}`,
        at = Date.now() - i * 1000;
      insertVisit.run(
        id,
        `benchmark-user-${i % 12000}`,
        at,
        at + 300,
        "/",
        "/checkout",
        "Direct",
        "Mobile",
        "Chrome",
        "Unknown",
        25000,
        2,
        1,
        1,
      );
      for (const [type, index] of [
        ["page_view", 0],
        ["page_view", 1],
        ["add_to_cart", 2],
        ["checkout_start", 3],
      ])
        insertEvent.run(
          `benchmark-event-${i}-${index}`,
          id,
          at + index * 100,
          type,
          index ? "/checkout" : "/",
          "",
          0,
        );
    }
    const insertOrder = db.prepare(
      "INSERT INTO orders(number,token,idempotency_key,created_at,status,data,visit_id) VALUES (?,?,?,?,?,?,?)",
    );
    for (let i = 0; i < 10000; i++)
      insertOrder.run(
        `BENCH-${i}`,
        randomUUID(),
        randomUUID(),
        now,
        i % 2 ? "delivered" : "new",
        JSON.stringify({
          currency: "USD",
          symbol: "$",
          total_in_cents: 6500,
          customer: { name: `Benchmark customer ${i}`, phone: "555 12345" },
          items: [],
        }),
        `benchmark-visit-${i}`,
      );
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const login = await fetch(base + "/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "admin@admin" }),
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const results = [];
  async function measure(
    label,
    route,
    { count = 100, concurrency = 10, method = "GET", body, admin = false } = {},
  ) {
    const times = [];
    let cursor = 0;
    const started = performance.now();
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (cursor < count) {
          const i = cursor++,
            start = performance.now();
          const response = await fetch(base + route, {
            method,
            headers: {
              ...(admin ? { Cookie: cookie } : {}),
              "Content-Type": "application/json",
            },
            body: body ? JSON.stringify(body(i)) : undefined,
          });
          if (!response.ok)
            throw new Error(`${label}: HTTP ${response.status}`);
          await response.arrayBuffer();
          times.push(performance.now() - start);
        }
      }),
    );
    times.sort((a, b) => a - b);
    results.push({
      label,
      requests: count,
      concurrency,
      p50_ms: +times[Math.floor(count * 0.5)].toFixed(1),
      p95_ms: +times[Math.floor(count * 0.95)].toFixed(1),
      total_ms: +(performance.now() - started).toFixed(1),
    });
  }
  await measure("Catalogue first page", "/products");
  await measure("Dashboard product page", "/admin/products?page=1", {
    admin: true,
  });
  await measure("Indexed product detail", "/products/benchmark-1200");
  await measure("Dashboard order page", "/admin/orders", { admin: true });
  await measure("Order status filter", "/admin/orders?status=delivered", {
    admin: true,
  });
  await measure(
    "Order customer search",
    "/admin/orders?search=customer%20900",
    { count: 20, concurrency: 4, admin: true },
  );
  await measure(
    "Analytics report (first cold query included)",
    "/admin/analytics",
    { count: 20, concurrency: 4, admin: true },
  );
  await measure("Transactional checkout", "/orders", {
    count: 16,
    concurrency: 8,
    method: "POST",
    body: (i) => ({
      idempotency_key: randomUUID(),
      payment_method: "cod",
      customer: {
        name: "Benchmark customer",
        phone: "555 12345",
        address: "Test Street",
        city: "Test City",
        country: "Test Country",
      },
      items: [{ variant_id: "benchmark-1200-style", quantity: 1 }],
    }),
  });
  console.log(
    JSON.stringify(
      {
        dataset: {
          products: 2504,
          orders: 10000,
          visits: 20000,
          events: 80000,
        },
        database: db.prepare("PRAGMA integrity_check").get(),
        results,
      },
      null,
      2,
    ),
  );
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(temporary, { recursive: true, force: true });
}
