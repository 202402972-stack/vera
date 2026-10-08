import path from "node:path";
process.env.DATA_DIR = path.resolve("output/review-data");
process.env.NODE_ENV = "test";
process.env.PLATFORM_MODE = "1";
const { app } = await import("../server/platform/app.js");
const core = await import("../server/platform/core.js");
const { inTenant } = await import("../server/tenant.js");
const db = await import("../server/db.js");
const { formDemoProducts } = await import("../src/data/form-demo.js");
core
  .sql(
    "INSERT OR IGNORE INTO platform_users(sub,email,name,created) VALUES(?,?,?,?)",
  )
  .run("local-review", "review@example.test", "Local review", Date.now());
if (
  !core.sql("SELECT id FROM platform_stores WHERE slug=?").get("form-review")
) {
  const store = core.provision(
    core.sql("SELECT * FROM platform_users WHERE sub=?").get("local-review"),
    {
      name: "FORM",
      slug: "form-review",
      template: "form",
      password: "local-review-only-123",
    },
  );
  inTenant(store.id, store.url, () => {
    for (const [i, p] of formDemoProducts.entries()) {
      db.stmt("INSERT INTO products(id,data,position) VALUES(?,?,?)").run(
        p.id,
        JSON.stringify(p),
        i,
      );
      db.indexProductVariants(p);
    }
    db.setSetting(
      "collections",
      formDemoProducts.map((p, i) => ({
        id: `collection-${i}`,
        name: p.category,
        nameAr: ["أزياء", "أحذية", "إكسسوارات", "أشياء"][i],
        image: p.image,
        description: "",
        descriptionAr: "",
        published: true,
        productIds: [p.id],
      })),
    );
  });
}
app.listen(3001, "127.0.0.1", () =>
  console.log(
    "Local review: http://127.0.0.1:3001/demo/form — dashboard /s/form-review/admin (local-review-only-123). Isolated review data; never use in production.",
  ),
);
