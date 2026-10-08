import path from "node:path";
process.env.DATA_DIR = path.resolve("output/gala-review-data");
process.env.NODE_ENV = "test";
process.env.PLATFORM_MODE = "1";
const { app } = await import("../server/platform/app.js");
const core = await import("../server/platform/core.js");
const { inTenant } = await import("../server/tenant.js");
const db = await import("../server/db.js");
const { galaProducts, galaCollections, galaDemoTestimonials } =
  await import("../src/data/gala.js");
core
  .sql(
    "INSERT OR IGNORE INTO platform_users(sub,email,name,created) VALUES(?,?,?,?)",
  )
  .run("gala-review", "gala@example.test", "Local GALA review", Date.now());
if (
  !core.sql("SELECT id FROM platform_stores WHERE slug=?").get("gala-review")
) {
  const store = core.provision(
    core.sql("SELECT * FROM platform_users WHERE sub=?").get("gala-review"),
    {
      name: "MAISON VERE",
      slug: "gala-review",
      template: "gala",
      password: "local-review-only-123",
    },
  );
  inTenant(store.id, store.url, () => {
    for (const [i, p] of galaProducts.entries()) {
      db.stmt("INSERT INTO products(id,data,position) VALUES(?,?,?)").run(
        p.id,
        JSON.stringify(p),
        i,
      );
      db.indexProductVariants(p);
    }
    db.setSetting("collections", galaCollections);
    const settings = db.getSetting("store");
    settings.gala.testimonials = galaDemoTestimonials;
    db.setSetting("store", settings);
  });
}
app.listen(3002, "127.0.0.1", () =>
  console.log(
    "GALA review http://127.0.0.1:3002/demo/gala — /s/gala-review/admin (local-review-only-123). Isolated sample data.",
  ),
);
