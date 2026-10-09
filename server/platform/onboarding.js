import { rawDb, getSetting, setSetting, productsAll } from "../db.js";
import { inTenant, tenantId } from "../tenant.js";
import { sql, provision, token, publicStore, audit } from "./core.js";
import { requireUser, currentUser } from "./auth.js";
rawDb.exec(`CREATE TABLE IF NOT EXISTS platform_onboarding_drafts(id TEXT PRIMARY KEY,owner_id INTEGER NOT NULL,data TEXT NOT NULL,store_id INTEGER,updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS platform_funnel_events(id INTEGER PRIMARY KEY,owner_id INTEGER,store_id INTEGER,action TEXT NOT NULL,at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS platform_creation_keys(owner_id INTEGER NOT NULL,key TEXT NOT NULL,store_id INTEGER NOT NULL,PRIMARY KEY(owner_id,key));`);
export function event(ownerId, storeId, action) {
  sql(
    "INSERT INTO platform_funnel_events(owner_id,store_id,action,at) VALUES(?,?,?,?)",
  ).run(ownerId, storeId, action, Date.now());
}
export function readiness(s) {
  return inTenant(s.id, `/s/${s.slug}`, () => {
    const settings = getSetting("store", {}),
      products = productsAll(),
      review = getSetting("launch_review", {});
    const checks = [
      {
        id: "identity",
        section: "brand",
        ready: !!settings.name && !!settings.hero?.title,
      },
      {
        id: "product",
        section: "products",
        ready: products.some(
          (p) =>
            p.status === "published" &&
            p.images?.length &&
            p.variants?.some(
              (v) =>
                v.price_in_cents > 0 &&
                (!v.manage_inventory || v.inventory_quantity > 0),
            ),
        ),
      },
      {
        id: "shipping",
        section: "commerce",
        ready:
          !!settings.commerce?.allowedCountries?.length &&
          /^[A-Z]{3}$/.test(settings.checkout?.currency || "") &&
          Number.isSafeInteger(settings.checkout?.shippingInCents),
      },
      {
        id: "payment",
        section: "payments",
        ready:
          settings.commerce?.acceptingOrders !== false &&
          settings.commerce?.cashOnDelivery !== false,
      },
      {
        id: "policies",
        section: "content",
        ready:
          !!review.policies &&
          !!settings.pages?.shipping &&
          !!settings.pages?.returns &&
          !!settings.footer?.email &&
          !/example/.test(settings.footer.email),
      },
      { id: "mobile", section: "preview", ready: !!review.mobile },
    ];
    return {
      checks,
      review,
      percent: Math.round(
        (100 * checks.filter((c) => c.ready).length) / checks.length,
      ),
      canPublish:
        checks.every((c) => c.ready) &&
        !s.suspended &&
        Math.max(s.trial_until, s.access_until) > Date.now(),
      publicationState: s.publication_state,
    };
  });
}
function cleanDraft(b) {
  if (
    typeof b.name !== "string" ||
    b.name.length > 65 ||
    typeof b.slug !== "string" ||
    b.slug.length > 40
  )
    throw Error("Invalid brand fields.");
  if (
    !["gala", "form", "atelier"].includes(b.template) ||
    !["en", "ar"].includes(b.language) ||
    !["USD", "EGP", "EUR", "GBP", "SAR", "AED"].includes(b.currency)
  )
    throw Error("Choose a supported template, language and currency.");
  return {
    name: b.name,
    slug: b.slug,
    template: b.template,
    language: b.language,
    currency: b.currency,
    country: String(b.country || "").slice(0, 100),
    business: String(b.business || "").slice(0, 100),
    step: Math.max(1, Math.min(3, Number(b.step) || 1)),
  };
}
export function registerOnboarding(app, owned, rate) {
  app.get("/api/platform/onboarding", requireUser, (req, res) =>
    res.json({
      drafts: sql(
        "SELECT * FROM platform_onboarding_drafts WHERE owner_id=? AND store_id IS NULL ORDER BY updated DESC",
      )
        .all(req.user.id)
        .map((d) => ({ ...d, data: JSON.parse(d.data) })),
    }),
  );
  app.put("/api/platform/onboarding/:draftId", requireUser, (req, res) => {
    try {
      const id = req.params.draftId;
      if (!/^[a-z0-9-]{8,80}$/i.test(id))
        return res.status(400).json({ error: "Invalid draft ID." });
      const old = sql(
        "SELECT * FROM platform_onboarding_drafts WHERE id=?",
      ).get(id);
      if (old && old.owner_id !== req.user.id)
        return res.status(404).json({ error: "Draft not found." });
      if (old?.store_id)
        return res
          .status(409)
          .json({ error: "Draft already created a store." });
      const data = cleanDraft(req.body);
      sql(
        "INSERT INTO platform_onboarding_drafts(id,owner_id,data,updated) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated",
      ).run(id, req.user.id, JSON.stringify(data), Date.now());
      if (!old) {
        event(req.user.id, null, "onboarding_started");
        event(req.user.id, null, "template_selected");
      } else if (JSON.parse(old.data).template !== data.template)
        event(req.user.id, null, "template_selected");
      res.json({ id, savedAt: Date.now() });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.get("/api/platform/slug", requireUser, (req, res) => {
    const slug = String(req.query.slug || "");
    res.json({
      available:
        /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug) &&
        !sql("SELECT id FROM platform_stores WHERE slug=?").get(slug),
    });
  });
  app.post(
    "/api/platform/onboarding/:draftId/commit",
    requireUser,
    rate,
    (req, res) => {
      const draft = sql(
        "SELECT * FROM platform_onboarding_drafts WHERE id=? AND owner_id=?",
      ).get(req.params.draftId, req.user.id);
      if (!draft) return res.status(404).json({ error: "Draft not found." });
      if (draft.store_id)
        return res.json(
          publicStore(
            sql("SELECT * FROM platform_stores WHERE id=?").get(draft.store_id),
          ),
        );
      try {
        const data = cleanDraft(JSON.parse(draft.data));
        const store = provision(
          req.user,
          { ...data, password: token() },
          () => {
            sql(
              "UPDATE platform_onboarding_drafts SET store_id=?,updated=? WHERE id=?",
            ).run(tenantId(), Date.now(), draft.id);
            const settings = getSetting("store");
            settings.checkout.currency = data.currency;
            settings.checkout.symbol = data.currency;
            settings.commerce.allowedCountries = data.country
              ? [data.country]
              : [];
            settings.primaryLanguage = data.language;
            settings.hero.title = data.name;
            settings.translations.ar.hero ||= {};
            settings.translations.ar.hero.title = data.name;
            settings.footer.email = "";
            settings.footer.phone = "";
            settings.footer.location = data.country;
            setSetting("store", settings);
          },
        );
        sql(
          "UPDATE platform_onboarding_drafts SET store_id=?,updated=? WHERE id=?",
        ).run(store.id, Date.now(), draft.id);
        event(req.user.id, store.id, "draft_created");
        res.status(201).json(store);
      } catch (e) {
        res.status(400).json({ error: e.message });
      }
    },
  );
  app.get(
    "/api/platform/stores/:id/readiness",
    requireUser,
    owned,
    (req, res) => res.json(readiness(req.store)),
  );
  app.patch(
    "/api/platform/stores/:id/launch-review",
    requireUser,
    owned,
    (req, res) => {
      inTenant(req.store.id, `/s/${req.store.slug}`, () => {
        const old = getSetting("launch_review", {});
        for (const k of ["policies", "mobile"])
          if (typeof req.body[k] === "boolean") old[k] = req.body[k];
        setSetting("launch_review", old);
      });
      res.json(readiness(req.store));
    },
  );
  app.post(
    "/api/platform/stores/:id/publish",
    requireUser,
    rate,
    owned,
    (req, res) => {
      const result = readiness(req.store);
      if (!result.canPublish)
        return res
          .status(409)
          .json({
            error: "Complete readiness and renew access before publishing.",
            ...result,
          });
      if (req.store.publication_state !== "published") {
        sql(
          "UPDATE platform_stores SET publication_state='published' WHERE id=?",
        ).run(req.store.id);
        event(req.user.id, req.store.id, "store_published");
        audit(req.user.id, "store.published", req.store.id);
      }
      res.json({ ok: true });
    },
  );
}
export function previewAuthorized(req, s) {
  const user = currentUser(req);
  return user?.id === s.owner_id && req.query.preview === "1";
}
