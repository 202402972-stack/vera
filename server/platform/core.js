import { migrateAtelierImages } from "../atelier-images.js";
import { ensureGalaSchema } from "../gala.js";
import { randomBytes, createHash, scryptSync } from "node:crypto";
import {
  rawDb,
  db,
  getSetting,
  setSetting,
  productsAll,
  indexProductVariants,
} from "../db.js";
import { inTenant, tenantSQL } from "../tenant.js";
import { ensureRetailSchema } from "../retail.js";
export const hash = (v) => createHash("sha256").update(v).digest("hex");
export const token = () => randomBytes(32).toString("base64url");
export const sql = (q) => rawDb.prepare(q);
export { publicTemplates as templates } from "../templates/registry.js";
import { templateRegistry } from "../templates/registry.js";
rawDb.exec(`
CREATE TABLE IF NOT EXISTS platform_templates(id TEXT PRIMARY KEY,preview_id INTEGER UNIQUE NOT NULL,version INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS platform_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS platform_users(id INTEGER PRIMARY KEY,sub TEXT UNIQUE NOT NULL,email TEXT NOT NULL,name TEXT NOT NULL,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS platform_sessions(hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES platform_users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS platform_oauth(hash TEXT PRIMARY KEY,nonce TEXT NOT NULL,verifier TEXT NOT NULL,intent TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS platform_stores(id INTEGER PRIMARY KEY,owner_id INTEGER NOT NULL REFERENCES platform_users(id),slug TEXT UNIQUE NOT NULL,name TEXT NOT NULL,template TEXT NOT NULL,paused INTEGER NOT NULL DEFAULT 0,suspended INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL,trial_until INTEGER NOT NULL,access_until INTEGER NOT NULL DEFAULT 0,customer TEXT,subscription TEXT UNIQUE,billing_status TEXT NOT NULL DEFAULT 'trial',checkout TEXT);
CREATE INDEX IF NOT EXISTS platform_stores_owner ON platform_stores(owner_id);
CREATE TABLE IF NOT EXISTS platform_audit(id INTEGER PRIMARY KEY,actor INTEGER,action TEXT NOT NULL,store_id INTEGER,at INTEGER NOT NULL,detail TEXT);
CREATE TABLE IF NOT EXISTS platform_admin_bridges(platform_session TEXT NOT NULL,store_id INTEGER NOT NULL,token_hash TEXT NOT NULL,PRIMARY KEY(platform_session,store_id,token_hash));
CREATE TABLE IF NOT EXISTS platform_billing_events(id TEXT PRIMARY KEY,at INTEGER NOT NULL);
`);
if (
  !sql("PRAGMA table_info(platform_stores)")
    .all()
    .some((c) => c.name === "publication_state")
)
  rawDb.exec(
    "ALTER TABLE platform_stores ADD COLUMN publication_state TEXT NOT NULL DEFAULT 'published'",
  );
if (
  !sql("PRAGMA table_info(platform_stores)")
    .all()
    .some((c) => c.name === "billing_plan_snapshot")
)
  rawDb.exec(
    "ALTER TABLE platform_stores ADD COLUMN billing_plan_snapshot TEXT",
  );
const tableNames = [
  "gala_messages",
  "gala_media",
  "settings",
  "products",
  "orders",
  "admin_sessions",
  "visits",
  "events",
  "discounts",
  "order_history",
  "subscribers",
  "variant_lookup",
  "shoppers",
  "shopper_sessions",
  "retail_reviews",
  "retail_returns",
];
const schema = sql(
  "SELECT name,tbl_name,sql,type FROM sqlite_master WHERE sql IS NOT NULL AND type IN ('table','index') ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END",
)
  .all()
  .filter((r) => tableNames.includes(r.tbl_name));
const indexes = schema.filter((r) => r.type === "index").map((r) => r.name);
for (const store of sql("SELECT id,slug,template FROM platform_stores").all())
  inTenant(store.id, `/s/${store.slug}`, () => {
    ensureRetailSchema();
    ensureGalaSchema();
    if (store.template === "atelier") migrateAtelierImages();
  });
export const owner = (user) =>
  !!user &&
  (process.env.OWNER_EMAILS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .includes(user.email.toLowerCase());
export const audit = (actor, action, storeId = null, detail = null) =>
  sql(
    "INSERT INTO platform_audit(actor,action,store_id,at,detail) VALUES(?,?,?,?,?)",
  ).run(actor, action, storeId, Date.now(), detail);
export const publicStore = (s) => ({
  id: s.id,
  name: s.name,
  slug: s.slug,
  template: s.template,
  paused: !!s.paused,
  suspended: !!s.suspended,
  created: s.created,
  trialUntil: s.trial_until,
  accessUntil: s.access_until,
  billingStatus: s.billing_status,
  billingPlan: s.billing_plan_snapshot
    ? (() => {
        const p = JSON.parse(s.billing_plan_snapshot);
        return {
          id: p.id,
          amount: p.amount_minor,
          currency: p.currency,
          provider: p.provider,
          intervalDays: p.interval_days,
        };
      })()
    : null,
  publicationState: s.publication_state,
  available:
    s.publication_state === "published" &&
    !s.paused &&
    !s.suspended &&
    Math.max(s.trial_until, s.access_until) > Date.now(),
  url: `/s/${s.slug}`,
  adminUrl: `/s/${s.slug}/admin`,
  workspaceUrl: `/workspace/stores/${s.id}/overview`,
});
export function setPassword(password) {
  const salt = randomBytes(32);
  setSetting("password_salt", salt.toString("hex"));
  setSetting(
    "password_fingerprint",
    scryptSync(password, salt, 64).toString("hex"),
  );
  db.prepare("DELETE FROM admin_sessions").run();
}
export function provision(
  user,
  { name, slug, template, password },
  initialize,
) {
  if (typeof name !== "string" || name.trim().length < 2 || name.length > 80)
    throw new Error("Store name must contain 2–80 characters.");
  if (
    typeof slug !== "string" ||
    !/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug)
  )
    throw new Error(
      "Use 3–40 lowercase letters, numbers or hyphens for the address.",
    );
  if (!templateRegistry.some((t) => t.id === template))
    throw new Error("Unknown template.");
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  )
    throw new Error("Password must contain 12–128 characters.");
  if (
    sql("SELECT count(*) n FROM platform_stores WHERE owner_id=?").get(user.id)
      .n >= 20
  )
    throw new Error("Store limit reached. Contact support.");
  rawDb.exec("BEGIN IMMEDIATE");
  try {
    const until = user.created + 14 * 86400000;
    const id = Number(
      sql(
        "INSERT INTO platform_stores(owner_id,slug,name,template,created,trial_until,publication_state) VALUES(?,?,?,?,?,?,'draft')",
      ).run(user.id, slug, name.trim(), template, Date.now(), until)
        .lastInsertRowid,
    );
    initializeTenant(
      id,
      `/s/${slug}`,
      templateRegistry.find((t) => t.id === template),
      name,
      password,
    );
    if (typeof initialize === "function")
      inTenant(id, `/s/${slug}`, initialize);
    audit(user.id, "store.created", id);
    rawDb.exec("COMMIT");
    return publicStore(sql("SELECT * FROM platform_stores WHERE id=?").get(id));
  } catch (e) {
    rawDb.exec("ROLLBACK");
    if (String(e.message).includes("UNIQUE"))
      throw new Error("This store address is already taken.");
    throw e;
  }
}

function initializeTenant(id, base, definition, name, password) {
  if (
    !sql("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(
      `t_${id}_settings`,
    )
  )
    for (const row of schema) rawDb.exec(tenantSQL(row.sql, id, indexes));
  inTenant(id, base, () => {
    const settings = structuredClone(definition.settings);
    settings.name = name.trim();
    settings.translations ||= {};
    settings.translations.ar ||= {};
    settings.translations.ar.name = name.trim();
    setSetting("template", {
      id: definition.id,
      version: definition.version,
      renderer: definition.renderer,
    });
    setSetting("store", settings);
    setSetting("store_version", 1);
    if (definition.collections)
      setSetting("collections", structuredClone(definition.collections));
    setPassword(password);
    for (const p of definition.products) {
      const { _version, ...data } = p;
      db.prepare("INSERT INTO products(id,data,position) VALUES(?,?,?)").run(
        p.id,
        JSON.stringify(data),
        definition.products.indexOf(p),
      );
      indexProductVariants(data);
    }
  });
}

export function platformSetting(key, fallback) {
  const row = sql("SELECT value FROM platform_settings WHERE key=?").get(key);
  return row ? JSON.parse(row.value) : fallback;
}
export function setPlatformSetting(key, value) {
  sql(
    "INSERT INTO platform_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  ).run(key, JSON.stringify(value));
}
export function ensurePreviews() {
  for (const definition of templateRegistry) {
    const existing = sql("SELECT * FROM platform_templates WHERE id=?").get(
      definition.id,
    );
    if (existing)
      inTenant(existing.preview_id, `/demo/${definition.id}`, () => {
        ensureRetailSchema();
        ensureGalaSchema();
      });
    if (existing?.version === definition.version) continue;
    rawDb.exec("BEGIN IMMEDIATE");
    try {
      const id =
        existing?.preview_id ||
        sql(
          "SELECT coalesce(max(preview_id),999999999)+1 n FROM platform_templates",
        ).get().n;
      if (existing)
        inTenant(id, `/demo/${definition.id}`, () => {
          for (const table of [
            "gala_messages",
            "gala_media",
            "retail_reviews",
            "retail_returns",
            "shopper_sessions",
            "shoppers",
            "order_history",
            "events",
            "visits",
            "variant_lookup",
            "orders",
            "products",
            "admin_sessions",
            "discounts",
            "subscribers",
            "settings",
          ])
            db.prepare(`DELETE FROM ${table}`).run();
        });
      initializeTenant(
        id,
        `/demo/${definition.id}`,
        {
          ...definition,
          settings: definition.previewSettings || definition.settings,
          collections: definition.previewCollections || definition.collections,
          products: definition.previewProducts || definition.products,
        },
        definition.settings.name,
        token(),
      );
      sql(
        "INSERT INTO platform_templates(id,preview_id,version) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version",
      ).run(definition.id, id, definition.version);
      rawDb.exec("COMMIT");
    } catch (e) {
      rawDb.exec("ROLLBACK");
      throw e;
    }
  }
}
