import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "vera-browser-"));
process.env.NODE_ENV = "test";
process.env.PLATFORM_MODE = "1";
process.env.OWNER_EMAILS = "owner@example.test";
process.env.PUBLIC_URL = "http://127.0.0.1:3300";
process.env.GOOGLE_CLIENT_ID = "test-client";
process.env.GOOGLE_CLIENT_SECRET = "test-secret";
const { app } = await import("../../server/platform/app.js");
const { sql, hash, provision } = await import("../../server/platform/core.js");
const { rawDb } = await import("../../server/db.js");
for (const [sub, email] of [
  ["alice", "owner@example.test"],
  ["bob", "bob@example.test"],
]) {
  sql("INSERT INTO platform_users(sub,email,name,created) VALUES(?,?,?,?)").run(
    sub,
    email,
    sub === "alice" ? "Mariam Hassan" : "Omar Ali",
    Date.now(),
  );
  const u = sql("SELECT * FROM platform_users WHERE sub=?").get(sub);
  sql("INSERT INTO platform_sessions(hash,user_id,expires) VALUES(?,?,?)").run(
    hash("fixture-" + sub),
    u.id,
    Date.now() + 86400000,
  );
  const fixture = provision(u, {
    name: sub === "alice" ? "Maison Véra" : "Second House",
    slug: sub === "alice" ? "maison-vera" : "second-house",
    template: "atelier",
    password: "test-private-password-123",
  });
  sql(
    "UPDATE platform_stores SET publication_state='published' WHERE id=?",
  ).run(fixture.id);
  const { catalogue } = await import("../../src/data/products.js");
  const { inTenant } = await import("../../server/tenant.js");
  const fixtureDb = await import("../../server/db.js");
  inTenant(fixture.id, fixture.url, () => {
    for (const [i, p] of catalogue.entries()) {
      fixtureDb
        .stmt("INSERT INTO products(id,data,position) VALUES(?,?,?)")
        .run(p.id, JSON.stringify(p), i);
      fixtureDb.indexProductVariants(p);
    }
  });
}
const server = app.listen(3300, "127.0.0.1");
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      rawDb.close();
      rmSync(process.env.DATA_DIR, { recursive: true, force: true });
      process.exit(0);
    }),
  );
// Separate merchant for GALA integration checks; existing fixture accounts stay unchanged.
const { inTenant } = await import("../../server/tenant.js");
const db = await import("../../server/db.js");
const { galaProducts, galaCollections } =
  await import("../../src/data/gala.js");
sql("INSERT INTO platform_users(sub,email,name,created) VALUES(?,?,?,?)").run(
  "gala-browser",
  "gala-browser@example.test",
  "GALA test",
  Date.now(),
);
const gala = provision(
  sql("SELECT * FROM platform_users WHERE sub=?").get("gala-browser"),
  {
    name: "GALA browser",
    slug: "gala-browser",
    template: "gala",
    password: "test-private-password-123",
  },
);
sql("UPDATE platform_stores SET publication_state='published' WHERE id=?").run(
  gala.id,
);
inTenant(gala.id, gala.url, () => {
  for (const [i, p] of galaProducts.entries()) {
    db.stmt("INSERT INTO products(id,data,position) VALUES(?,?,?)").run(
      p.id,
      JSON.stringify(p),
      i,
    );
    db.indexProductVariants(p);
  }
  db.setSetting("collections", galaCollections);
});
const { formDemoProducts } = await import("../../src/data/form-demo.js");
const fixtureOwner = sql(
  "SELECT * FROM platform_users WHERE sub='alice'",
).get();
for (const [template, slug, seed] of [
  ["form", "form-browser", formDemoProducts],
  ["gala", "gala-owned", galaProducts],
]) {
  const s = provision(fixtureOwner, {
    name: template.toUpperCase() + " owned",
    slug,
    template,
    password: "test-private-password-123",
  });
  sql(
    "UPDATE platform_stores SET publication_state='published' WHERE id=?",
  ).run(s.id);
  inTenant(s.id, s.url, () => {
    for (const [i, p] of seed.entries()) {
      db.stmt("INSERT INTO products(id,data,position) VALUES(?,?,?)").run(
        p.id,
        JSON.stringify(p),
        i,
      );
      db.indexProductVariants(p);
    }
  });
}
const { startImportWorker } = await import("../../server/imports/jobs.js");
const stopImports = startImportWorker();
process.on("SIGTERM", stopImports);
process.on("SIGINT", stopImports);
