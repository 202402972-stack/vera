import { tenantSQL, tenantId, registerTenantIdentifiers } from "./tenant.js";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { catalogue } from "../src/data/products.js";
import { arabicStore, productSeedTranslation } from "../src/i18n/content.js";
import { defaultSettings } from "../src/data/settings.js";

export const dataDir = path.resolve(
  process.env.DATA_DIR ||
    (process.env.RAILWAY_ENVIRONMENT ? "/data" : "./data"),
);
mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
const keyPath = path.join(dataDir, ".encryption-key");
if (!existsSync(keyPath))
  writeFileSync(keyPath, randomBytes(32), { mode: 0o600 });
const encryptionKey = readFileSync(keyPath);
export function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64",
  );
}
export function decrypt(value) {
  if (!value) return "";
  const bytes = Buffer.from(value, "base64");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey,
    bytes.subarray(0, 12),
  );
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    cipher.update(bytes.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}
export const rawDb = new DatabaseSync(path.join(dataDir, "store.sqlite"));
export const db = { close: () => rawDb.close(), prepare: sql => rawDb.prepare(tenantSQL(sql)), exec: sql => rawDb.exec(tenantSQL(sql)) };
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA synchronous=NORMAL;
  PRAGMA foreign_keys=ON;
  PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT UNIQUE, token TEXT NOT NULL UNIQUE,
    idempotency_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
    data TEXT NOT NULL, telegram_status TEXT NOT NULL DEFAULT 'pending', telegram_error TEXT,
    telegram_attempts INTEGER NOT NULL DEFAULT 0, telegram_next_attempt INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY, visitor TEXT NOT NULL, started_at INTEGER NOT NULL, last_at INTEGER NOT NULL,
    entry TEXT NOT NULL, exit TEXT NOT NULL, referrer TEXT, device TEXT, browser TEXT, country TEXT,
    source TEXT, medium TEXT, campaign TEXT, duration INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS visits_started ON visits(started_at);
  CREATE INDEX IF NOT EXISTS visits_visitor ON visits(visitor);
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, session TEXT NOT NULL, at INTEGER NOT NULL,
    type TEXT NOT NULL, path TEXT NOT NULL, label TEXT, value INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS events_at_type ON events(at, type);
  CREATE INDEX IF NOT EXISTS events_session ON events(session);
  CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at);
  CREATE TABLE IF NOT EXISTS discounts (code TEXT PRIMARY KEY, data TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS order_history (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id), status TEXT NOT NULL, at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS order_history_order ON order_history(order_id,id);
  CREATE TABLE IF NOT EXISTS subscribers (email TEXT PRIMARY KEY, created_at TEXT NOT NULL);
`);
export function getSetting(key, fallback = null) {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key);
  return row ? JSON.parse(row.value) : fallback;
}
export function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  ).run(key, JSON.stringify(value));
}
if (!getSetting("seeded")) {
  db.exec("BEGIN IMMEDIATE");
  try {
    setSetting("store", defaultSettings);
    catalogue.forEach((product, i) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO products(id,data,position) VALUES(?,?,?)",
        )
        .run(product.id, JSON.stringify(product), i),
    );
    setSetting("seeded", true);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function transaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function productsAll() {
  return db
    .prepare("SELECT data,version FROM products ORDER BY position,id")
    .all()
    .map((row) => ({ ...JSON.parse(row.data), _version: row.version || 1 }));
}
export function orderObject(row, privateView = true) {
  if (!row) return null;
  const result = {
    ...JSON.parse(row.data),
    id: row.id,
    number: row.number,
    created_at: row.created_at,
    status: row.status,
  };
  if (privateView)
    Object.assign(result, {
      telegram_status: row.telegram_status,
      telegram_error: row.telegram_error,
      telegram_attempts: row.telegram_attempts,
    });
  return result;
}

// Additive migrations preserve the original catalogue and existing orders.
function addColumn(table, name, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((column) => column.name === name))
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}
transaction(() => {
  addColumn("products", "version", "INTEGER NOT NULL DEFAULT 1");
  addColumn("orders", "telegram_lease_until", "INTEGER NOT NULL DEFAULT 0");
  addColumn("orders", "telegram_message_id", "INTEGER");
  addColumn("orders", "telegram_sent_at", "TEXT");
  addColumn("orders", "visit_id", "TEXT");
  addColumn("visits", "pageviews", "INTEGER NOT NULL DEFAULT 0");
  addColumn("visits", "cart", "INTEGER NOT NULL DEFAULT 0");
  addColumn("visits", "checkout", "INTEGER NOT NULL DEFAULT 0");
  addColumn("events", "event_id", "TEXT");
  db.exec(`
    CREATE TABLE IF NOT EXISTS variant_lookup (
      id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS variant_product ON variant_lookup(product_id);
    CREATE INDEX IF NOT EXISTS products_position ON products(position,id);
    CREATE INDEX IF NOT EXISTS orders_status_id ON orders(status,id DESC);
    CREATE INDEX IF NOT EXISTS orders_delivery_queue ON orders(telegram_status,telegram_next_attempt,id);
    CREATE INDEX IF NOT EXISTS orders_visit_created ON orders(visit_id,created_at);
    CREATE INDEX IF NOT EXISTS visits_last ON visits(last_at DESC);
    CREATE INDEX IF NOT EXISTS visits_visitor_started ON visits(visitor,started_at);
    CREATE INDEX IF NOT EXISTS events_session_type ON events(session,type,at);
    CREATE UNIQUE INDEX IF NOT EXISTS event_dedup ON events(event_id) WHERE event_id IS NOT NULL;
  `);
  if (!getSetting("schema_v2")) {
    for (const p of productsAll()) indexProductVariants(p);
    db.exec(`UPDATE visits SET
      pageviews=(SELECT COUNT(*) FROM events WHERE session=visits.id AND type='page_view'),
      cart=EXISTS(SELECT 1 FROM events WHERE session=visits.id AND type='add_to_cart'),
      checkout=EXISTS(SELECT 1 FROM events WHERE session=visits.id AND type='checkout_start')`);
    setSetting("schema_v2", true);
  }
});
db.exec(
  `PRAGMA synchronous=FULL; PRAGMA cache_size=-20000; PRAGMA mmap_size=268435456; CREATE INDEX IF NOT EXISTS products_status_position ON products(json_extract(data,'$.status'),position,id); CREATE INDEX IF NOT EXISTS events_type_at_path ON events(type,at,path); PRAGMA optimize;`,
);
registerTenantIdentifiers(rawDb.prepare("SELECT name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL AND tbl_name NOT LIKE 'platform_%'").all().map(r=>r.name));
const statements = new Map();
export function stmt(sql) {
  const key = tenantId() + ":" + sql;
  if (!statements.has(key)) {
    if (statements.size >= 512)
      statements.delete(statements.keys().next().value);
    statements.set(key, db.prepare(sql));
  }
  return statements.get(key);
}
export function indexProductVariants(product) {
  db.prepare("DELETE FROM variant_lookup WHERE product_id=?").run(product.id);
  for (const variant of product.variants)
    db.prepare("INSERT INTO variant_lookup(id,product_id) VALUES (?,?)").run(
      variant.id,
      product.id,
    );
}
export function productById(id) {
  const row = stmt("SELECT data,version FROM products WHERE id=?").get(id);
  return row ? { ...JSON.parse(row.data), _version: row.version } : null;
}
export function writeProduct(product, checkVersion = false) {
  const sql = checkVersion
    ? "UPDATE products SET data=?,version=version+1 WHERE id=? AND version=?"
    : "UPDATE products SET data=?,version=version+1 WHERE id=?";
  const { _version, ...data } = product;
  return stmt(sql).run(
    JSON.stringify(data),
    product.id,
    ...(checkVersion ? [_version] : []),
  );
}
export function productForVariant(id) {
  const row = stmt(
    "SELECT p.id,p.data,p.version FROM variant_lookup v JOIN products p ON p.id=v.product_id WHERE v.id=?",
  ).get(id);
  return row ? { ...JSON.parse(row.data), _version: row.version } : null;
}

if (!getSetting("bilingual_seed")) {
  transaction(() => {
    const store = getSetting("store");
    store.translations ||= {};
    if (!store.translations.ar) {
      const translation = {};
      for (const [group, value] of Object.entries(arabicStore)) {
        if (typeof value === "string") {
          if (store[group] === defaultSettings[group])
            translation[group] = value;
        } else {
          const fields = {};
          for (const [key, text] of Object.entries(value)) {
            if (
              JSON.stringify(store[group]?.[key]) ===
              JSON.stringify(defaultSettings[group]?.[key])
            )
              fields[key] = text;
          }
          if (Object.keys(fields).length) translation[group] = fields;
        }
      }
      store.translations.ar = translation;
      setSetting("store", store);
    }
    for (const p of productsAll()) {
      const original = catalogue.find((x) => x.id === p.id);
      if (original && !p.translations) {
        const tr = productSeedTranslation(p),
          filtered = {};
        for (const key of ["title", "subtitle", "description", "ribbon_text"])
          if (p[key] === original[key]) filtered[key] = tr[key];
        filtered.variants = tr.variants.filter((v) =>
          original.variants.some(
            (o) =>
              o.id === v.id &&
              o.title === p.variants.find((x) => x.id === v.id)?.title,
          ),
        );
        if (
          JSON.stringify(p.additional_info) ===
          JSON.stringify(original.additional_info)
        )
          filtered.additional_info = tr.additional_info;
        writeProduct({ ...p, translations: { ar: filtered } });
      }
    }
    setSetting("bilingual_seed", true);
  });
}
