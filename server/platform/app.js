import {
  limits,
  validateImportLimits,
  saveImportLimits,
} from "../imports/limits.js";
import { recordMigrations } from "./migrations.js";
import { features, saveFeatures } from "./features.js";
import { registerConnections } from "../imports/connections.js";
import { registerOwner } from "./owner.js";
import { registerPlatformSEO } from "../seo.js";
import { registerImports } from "../imports/routes.js";
import {
  displayPricing,
  saveDisplayPricing,
  providerPlan,
  stripePlan,
} from "./pricing.js";
import {
  registerOnboarding,
  previewAuthorized,
  event,
  readiness,
} from "./onboarding.js";
import {
  paymobSelected,
  paymobReady,
  paymobPlan,
  registerPaymob,
  registerPaymobWebhook,
} from "./paymob.js";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import path from "node:path";
import { app as storeApp } from "../index.js";
import { db, dataDir } from "../db.js";
import { inTenant, adminCookie } from "../tenant.js";
import {
  sql,
  platformSetting,
  setPlatformSetting,
  ensurePreviews,
  templates,
  publicStore,
  provision,
  setPassword,
  audit,
  token,
  hash,
} from "./core.js";
import {
  cookie,
  currentUser,
  requireUser,
  requireOwner,
  registerAuth,
  cookieOptions,
} from "./auth.js";
import {
  billingReady,
  registerWebhook,
  registerBilling,
  stripe,
} from "./billing.js";
ensurePreviews();
recordMigrations();
export const app = express();
registerPlatformSEO(app, sql);
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  ["/workspace", "/owner", "/demo", "/api/platform", "/api/admin"],
  (_req, res, next) => {
    res.set("X-Robots-Tag", "noindex,nofollow");
    next();
  },
);
app.use("/api/platform", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "img-src": ["'self'", "data:", "https:"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "font-src": ["'self'", "data:"],
        "script-src": ["'self'"],
        "connect-src": ["'self'"],
        "upgrade-insecure-requests":
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
  }),
);
app.use(compression());
registerWebhook(app);
app.use("/api/platform/import-jobs", express.json({ limit: "12mb" }));
app.use("/api/platform/import-csv", express.json({ limit: "12mb" }));
app.use(express.json({ limit: "2mb" }));
registerPaymobWebhook(app);
app.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.origin;
    if (
      req.headers["sec-fetch-site"] === "cross-site" ||
      (origin &&
        origin !== `${req.protocol}://${req.get("host")}` &&
        origin !== process.env.PUBLIC_URL)
    )
      return res.status(403).json({ error: "Cross-site request rejected." });
    if (
      req.body !== undefined &&
      (!req.body || Array.isArray(req.body) || typeof req.body !== "object")
    )
      return res.status(400).json({ error: "Invalid request body." });
  }
  next();
});
const buckets = new Map();
function rate(req, res, next) {
  const key =
    req.ip +
    ":" +
    (req.user?.id || "public") +
    ":" +
    (req.route?.path || req.path);
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.until < now) b = { n: 0, until: now + 900000 };
  b.n++;
  buckets.set(key, b);
  if (b.n > 50) {
    res.set("Retry-After", "900");
    return res
      .status(429)
      .json({ error: "Too many attempts. Try again later." });
  }
  next();
}
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.until < now) buckets.delete(k);
  for (const b of sql(
    "SELECT b.*,s.slug FROM platform_admin_bridges b JOIN platform_stores s ON s.id=b.store_id LEFT JOIN platform_sessions p ON p.hash=b.platform_session WHERE p.hash IS NULL OR p.expires<?",
  ).all(now)) {
    inTenant(b.store_id, `/s/${b.slug}`, () =>
      db
        .prepare("DELETE FROM admin_sessions WHERE token_hash=?")
        .run(b.token_hash),
    );
    sql(
      "DELETE FROM platform_admin_bridges WHERE platform_session=? AND token_hash=?",
    ).run(b.platform_session, b.token_hash);
  }
  sql("DELETE FROM platform_sessions WHERE expires<?").run(now);
  sql("DELETE FROM platform_oauth WHERE expires<?").run(now);
}, 60000);
cleanup.unref();
app.get("/api/health", (_req, res) => {
  sql("SELECT 1").get();
  res.json({ ok: true, platform: true });
});
app.get("/api/platform/config", async (req, res) => {
  let plan = paymobPlan();
  if (!paymobSelected && billingReady) {
    try {
      const p = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID);
      plan = {
        amount: p.unit_amount,
        currency: p.currency,
        interval: p.recurring?.interval,
        planId: stripePlan(p).id,
      };
    } catch {}
  }
  res.set("Cache-Control", "no-store").json({
    name: "VÉRA",
    googleReady: !!(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
    billingReady: paymobSelected ? paymobReady : billingReady,
    billingProvider: paymobSelected ? "paymob" : "stripe",
    marketingPriceCents: platformSetting("marketingPriceCents", 150),
    displayPricing: features().displayPricing
      ? displayPricing()
      : {
          displayDefaultCurrency: "USD",
          displayPrices: {
            USD: platformSetting("marketingPriceCents", 150),
            EGP: null,
          },
        },
    features: features(),
    importLimits: limits,
    plan: plan
      ? { ...plan, planId: paymobSelected ? providerPlan()?.id : plan.planId }
      : null,
    trialDays: 14,
    supportEmail: platformSetting(
      "supportEmail",
      process.env.SUPPORT_EMAIL || "",
    ),
    templates,
    user: currentUser(req),
  });
});
registerAuth(app, rate);
app.use("/api/platform", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.get("/api/platform/stores", requireUser, (req, res) =>
  res.json({
    stores: sql(
      "SELECT * FROM platform_stores WHERE owner_id=? ORDER BY created DESC",
    )
      .all(req.user.id)
      .map((s) => ({
        ...publicStore(s),
        readiness: readiness(s),
        updated:
          sql("SELECT max(at) at FROM platform_audit WHERE store_id=?").get(
            s.id,
          ).at || s.created,
      })),
  }),
);
app.post("/api/platform/stores", requireUser, rate, (req, res) => {
  try {
    res.status(201).json(provision(req.user, req.body));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
function owned(req, res, next) {
  const s = sql("SELECT * FROM platform_stores WHERE id=? AND owner_id=?").get(
    Number(req.params.id) || 0,
    req.user.id,
  );
  if (!s) return res.status(404).json({ error: "Store not found." });
  req.store = s;
  next();
}
app.patch("/api/platform/stores/:id", requireUser, rate, owned, (req, res) => {
  if (typeof req.body.paused !== "boolean")
    return res.status(400).json({ error: "A paused state is required." });
  sql("UPDATE platform_stores SET paused=? WHERE id=?").run(
    +req.body.paused,
    req.store.id,
  );
  audit(
    req.user.id,
    req.body.paused ? "store.paused" : "store.resumed",
    req.store.id,
  );
  res.json(
    publicStore(
      sql("SELECT * FROM platform_stores WHERE id=?").get(req.store.id),
    ),
  );
});
app.post(
  "/api/platform/stores/:id/password",
  requireUser,
  rate,
  owned,
  (req, res) => {
    const p = req.body.password;
    if (typeof p !== "string" || p.length < 12 || p.length > 128)
      return res.status(400).json({ error: "Use 12–128 characters." });
    inTenant(req.store.id, `/s/${req.store.slug}`, () => setPassword(p));
    audit(req.user.id, "store.password_reset", req.store.id);
    res.json({ ok: true });
  },
);
app.post(
  "/api/platform/stores/:id/admin-entry",
  requireUser,
  rate,
  owned,
  (req, res) => {
    if (req.store.suspended)
      return res
        .status(403)
        .json({ error: "This store has been suspended. Contact support." });
    inTenant(req.store.id, `/s/${req.store.slug}`, () => {
      const sessionHash = hash(cookie(req, "vera_session")),
        expires = Math.min(
          Date.now() + 7 * 86400000,
          sql("SELECT expires FROM platform_sessions WHERE hash=?").get(
            sessionHash,
          ).expires,
        );
      for (const old of sql(
        "SELECT token_hash FROM platform_admin_bridges WHERE platform_session=? AND store_id=?",
      ).all(sessionHash, req.store.id))
        db.prepare("DELETE FROM admin_sessions WHERE token_hash=?").run(
          old.token_hash,
        );
      sql(
        "DELETE FROM platform_admin_bridges WHERE platform_session=? AND store_id=?",
      ).run(sessionHash, req.store.id);
      const value = token();
      db.prepare(
        "INSERT INTO admin_sessions(token_hash,expires_at) VALUES(?,?)",
      ).run(hash(value), expires);
      sql(
        "INSERT INTO platform_admin_bridges(platform_session,store_id,token_hash) VALUES(?,?,?)",
      ).run(hash(cookie(req, "vera_session")), req.store.id, hash(value));
      res.cookie(adminCookie(), value, {
        ...cookieOptions(req),
        path: `/s/${req.store.slug}`,
        sameSite: "strict",
        maxAge: expires - Date.now(),
      });
    });
    audit(req.user.id, "store.admin_entry", req.store.id);
    res.json({
      url: `/s/${req.store.slug}/admin`,
      store: publicStore(req.store),
    });
  },
);
registerOnboarding(app, owned, rate);
registerImports(app, rate);
registerConnections(app, rate);
registerOwner(app);
registerPaymob(app, owned, rate);
if (!paymobSelected) registerBilling(app, owned, rate);
app.get("/api/platform/owner", requireOwner, (req, res) => {
  const page = Math.max(0, Math.min(10000, Number(req.query.page) || 0));
  const stores = sql(
    "SELECT s.*,u.email FROM platform_stores s JOIN platform_users u ON u.id=s.owner_id ORDER BY s.created DESC LIMIT 50 OFFSET ?",
  ).all(page * 50);
  const activity = sql(
    "SELECT a.*,u.email FROM platform_audit a LEFT JOIN platform_users u ON u.id=a.actor ORDER BY a.id DESC LIMIT 100",
  ).all();
  const users = sql(
    "SELECT u.id,u.email,u.name,u.created,(SELECT count(*) FROM platform_stores WHERE owner_id=u.id) stores FROM platform_users u ORDER BY u.id DESC LIMIT 50 OFFSET ?",
  ).all(page * 50);
  res.json({
    counts: {
      users: sql("SELECT count(*) n FROM platform_users").get().n,
      stores: sql("SELECT count(*) n FROM platform_stores").get().n,
      active: sql(
        "SELECT count(*) n FROM platform_stores WHERE paused=0 AND suspended=0 AND max(trial_until,access_until)>?",
      ).get(Date.now()).n,
    },
    users,
    stores: stores.map((s) => ({
      ...publicStore(s),
      email: s.email,
      ...inTenant(s.id, `/s/${s.slug}`, () => ({
        orders: db.prepare("SELECT count(*) n FROM orders").get().n,
        visits: db.prepare("SELECT count(*) n FROM visits").get().n,
      })),
    })),
    activity,
    page,
  });
});
app.patch("/api/platform/owner/stores/:id", requireOwner, rate, (req, res) => {
  const s = sql("SELECT * FROM platform_stores WHERE id=?").get(
    Number(req.params.id) || 0,
  );
  if (!s) return res.status(404).json({ error: "Store not found." });
  if (typeof req.body.suspended !== "boolean")
    return res.status(400).json({ error: "A suspension state is required." });
  if (
    typeof req.body.reason !== "string" ||
    req.body.reason.trim().length < 3 ||
    req.body.reason.length > 500
  )
    return res
      .status(400)
      .json({ error: "A reason of 3–500 characters is required." });
  sql("UPDATE platform_stores SET suspended=? WHERE id=?").run(
    +req.body.suspended,
    s.id,
  );
  inTenant(s.id, `/s/${s.slug}`, () =>
    db.prepare("DELETE FROM admin_sessions").run(),
  );
  audit(
    req.user.id,
    req.body.suspended ? "owner.suspended" : "owner.restored",
    s.id,
    req.body.reason.trim(),
  );
  res.json({ ok: true });
});
app.get("/api/platform/owner/settings", requireOwner, (_req, res) =>
  res.json({
    marketingPriceCents: platformSetting("marketingPriceCents", 150),
    displayPricing: displayPricing(),
    features: features(),
    importLimits: limits,
    supportEmail: platformSetting(
      "supportEmail",
      process.env.SUPPORT_EMAIL || "",
    ),
    googleReady: !!(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
    billingReady: paymobSelected ? paymobReady : billingReady,
    billingProvider: paymobSelected ? "Paymob" : "Stripe",
  }),
);
app.patch("/api/platform/owner/settings", requireOwner, rate, (req, res) => {
  const { marketingPriceCents, supportEmail } = req.body;
  if (
    !Number.isSafeInteger(marketingPriceCents) ||
    marketingPriceCents < 1 ||
    marketingPriceCents > 100000 ||
    typeof supportEmail !== "string" ||
    supportEmail.length > 254 ||
    !/^\S+@\S+\.\S+$/.test(supportEmail)
  )
    return res
      .status(400)
      .json({ error: "Enter a valid price and support email." });
  if (req.body.importLimits) {
    try {
      validateImportLimits(req.body.importLimits);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }
  if (
    req.body.features &&
    (Array.isArray(req.body.features) ||
      typeof req.body.features !== "object" ||
      Object.entries(req.body.features).some(
        ([k, v]) => !Object.hasOwn(features(), k) || typeof v !== "boolean",
      ))
  )
    return res.status(400).json({ error: "Invalid feature flags." });
  if (req.body.displayPricing) {
    try {
      saveDisplayPricing(req.body.displayPricing);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }
  if (req.body.features) {
    try {
      saveFeatures(req.body.features);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }
  if (req.body.importLimits) saveImportLimits(req.body.importLimits);
  setPlatformSetting("marketingPriceCents", marketingPriceCents);
  setPlatformSetting("supportEmail", supportEmail);
  audit(req.user.id, "owner.settings_updated");
  res.json({ ok: true });
});
app.use("/s/:slug", (req, res, next) => {
  const s = sql("SELECT * FROM platform_stores WHERE slug=?").get(
    req.params.slug,
  );
  if (!s) return res.status(404).send("Store not found.");
  if (req.method === "POST" && req.path === "/api/payments/webhook")
    return inTenant(s.id, `/s/${s.slug}`, () => storeApp(req, res, next));
  const adminRoute =
    req.path === "/admin" || req.path.startsWith("/api/admin/");
  const privatePreview = previewAuthorized(req, s);
  if (adminRoute) {
    res.set("X-Robots-Tag", "noindex,nofollow");
    if (currentUser(req)?.id === s.owner_id && features().workspace)
      req.workspaceUrl = `/workspace/stores/${s.id}/overview`;
  }
  if (privatePreview && !["GET", "HEAD"].includes(req.method))
    return res.status(403).json({ error: "Private preview is read only." });
  if (privatePreview)
    res
      .set("X-Robots-Tag", "noindex, nofollow")
      .set("Cache-Control", "private,no-store");
  if (
    s.suspended ||
    (!adminRoute &&
      !privatePreview &&
      (s.publication_state !== "published" ||
        s.paused ||
        Math.max(s.trial_until, s.access_until) <= Date.now()))
  ) {
    res.set("Retry-After", "3600");
    return req.path.startsWith("/api/")
      ? res.status(503).json({ error: "This store is currently unavailable." })
      : res
          .status(503)
          .send(
            '<!doctype html><meta name="viewport" content="width=device-width"><title>Store unavailable</title><main style="font-family:system-ui;text-align:center;padding:15vh 24px"><h1>We’ll be back soon.</h1><p>This store is currently unavailable.</p><a href="/workspace">Manage your store</a></main>',
          );
  }
  const endpoint = req.path;
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
    /^\/api\/admin\/(products|store|collections)(\/|$)/.test(endpoint) &&
    !endpoint.endsWith("/preview")
  )
    res.once("finish", () => {
      if (res.statusCode < 400)
        audit(
          s.owner_id,
          "store.content_updated",
          s.id,
          JSON.stringify({
            method: req.method,
            resource: endpoint.split("/")[3],
          }),
        );
    });
  if (
    (req.method === "POST" && endpoint === "/api/orders") ||
    (["POST", "PUT"].includes(req.method) &&
      endpoint.startsWith("/api/admin/products"))
  )
    res.once("finish", () => {
      if (res.statusCode >= 400) return;
      try {
        const action =
          endpoint === "/api/orders" ? "first_order" : "first_product_ready";
        if (
          action === "first_product_ready" &&
          !readiness(s).checks.find((c) => c.id === "product").ready
        )
          return;
        if (
          !sql(
            "SELECT id FROM platform_funnel_events WHERE store_id=? AND action=?",
          ).get(s.id, action)
        )
          event(s.owner_id, s.id, action);
      } catch {
        console.error("Commerce funnel event could not be recorded");
      }
    });
  return inTenant(s.id, `/s/${s.slug}`, () => storeApp(req, res, next));
});
app.use("/demo/:template", (req, res, next) => {
  const preview = sql("SELECT * FROM platform_templates WHERE id=?").get(
    req.params.template,
  );
  if (!preview || !templates.some((t) => t.id === req.params.template))
    return res.status(404).send("Template not found.");
  if (
    req.path.startsWith("/api/admin") ||
    !["GET", "HEAD"].includes(req.method)
  )
    return res
      .status(403)
      .json({ error: "This is a read-only template preview." });
  inTenant(preview.preview_id, `/demo/${req.params.template}`, () =>
    storeApp(req, res, next),
  );
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Endpoint not found." }),
);
app.use(
  "/uploads",
  express.static(path.join(dataDir, "uploads"), {
    immutable: true,
    maxAge: "1y",
    index: false,
  }),
);
app.use(express.static(path.resolve("dist"), { index: false }));
app.get(
  [
    "/",
    "/login",
    "/workspace",
    /^\/workspace\/.*/,
    /^\/owner\/.*/,
    "/owner",
    "/templates",
    "/privacy",
    "/terms",
    "/design-system",
  ],
  (_req, res) => res.sendFile(path.resolve("dist/index.html")),
);
app.use((_req, res) => res.status(404).send("Page not found."));
app.use((error, _req, res, _next) => {
  console.error("Platform request failed:", error.name);
  res.status(error.status === 400 ? 400 : 500).json({
    error:
      error.status === 400
        ? "Invalid request."
        : "The service is temporarily unavailable. Please try again.",
  });
});
