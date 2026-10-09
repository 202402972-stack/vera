import { templateRegistry } from "../../server/templates/registry.js";
// Explicit historical live-store fixtures. Production creation remains empty and draft.
export function publishFixture(core, db, tenant, store, { seed = false } = {}) {
  core
    .sql("UPDATE platform_stores SET publication_state='published' WHERE id=?")
    .run(store.id);
  if (seed)
    tenant.inTenant(store.id, store.url, () => {
      const definition = templateRegistry.find((t) => t.id === store.template);
      for (const [i, p] of (definition.previewProducts || []).entries()) {
        db.stmt(
          "INSERT OR IGNORE INTO products(id,data,position) VALUES(?,?,?)",
        ).run(p.id, JSON.stringify(p), i);
        db.indexProductVariants(p);
      }
    });
}
