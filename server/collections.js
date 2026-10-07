import { getSetting, setSetting, productById, transaction } from "./db.js";
import { HttpError, text } from "./validation.js";
export function registerCollections(app, admin) {
  const data = () => ({
    collections: getSetting("collections", []),
    version: getSetting("collections_version", 1),
  });
  app.get("/api/collections", (_req, res) =>
    res.json({
      collections: data()
        .collections.filter((c) => c.published)
        .map(({ productIds, ...c }) => ({
          ...c,
          count: productIds.filter(
            (id) => productById(id)?.status === "published",
          ).length,
        })),
    }),
  );
  app.get("/api/admin/collections", admin, (_req, res) => res.json(data()));
  app.put("/api/admin/collections", admin, (req, res, next) => {
    try {
      if (
        !Array.isArray(req.body.collections) ||
        req.body.collections.length > 50
      )
        throw new HttpError("Provide up to 50 collections.");
      const ids = new Set();
      const collections = req.body.collections.map((c) => {
        if (
          !c ||
          typeof c !== "object" ||
          typeof c.id !== "string" ||
          !/^[a-z0-9][a-z0-9-]{1,59}$/.test(c.id) ||
          ids.has(c.id)
        )
          throw new HttpError(
            "Collection addresses must be unique and contain 2–60 lowercase letters, numbers or hyphens.",
          );
        ids.add(c.id);
        if (
          !Array.isArray(c.productIds) ||
          c.productIds.length > 500 ||
          c.productIds.some((id) => typeof id !== "string" || !productById(id))
        )
          throw new HttpError(
            "Select up to 500 existing products per collection.",
          );
        return {
          id: c.id,
          name: text(c.name, "Collection name", 80),
          nameAr: text(c.nameAr || "", "Arabic collection name", 80, false),
          description: text(
            c.description || "",
            "Collection description",
            300,
            false,
          ),
          descriptionAr: text(
            c.descriptionAr || "",
            "Arabic collection description",
            300,
            false,
          ),
          published: c.published === true,
          productIds: [...new Set(c.productIds)],
        };
      });
      transaction(() => {
        if (req.body.version !== getSetting("collections_version", 1))
          throw new HttpError(
            "Collections changed. Reload before saving.",
            409,
          );
        setSetting("collections", collections);
        setSetting("collections_version", req.body.version + 1);
      });
      res.json(data());
    } catch (e) {
      next(e);
    }
  });
}
