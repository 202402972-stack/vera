// Run only after backing up the existing data volume. Secrets are read from env, never CLI args.
import { sql, provision, setPassword } from "../server/platform/core.js";
import { db, rawDb, getSetting, setSetting } from "../server/db.js";
const email = process.env.IMPORT_OWNER_EMAIL,
  slug = process.env.IMPORT_STORE_SLUG,
  password = process.env.IMPORT_STORE_PASSWORD;
if (!email || !slug || !password)
  throw new Error(
    "Set IMPORT_OWNER_EMAIL, IMPORT_STORE_SLUG and IMPORT_STORE_PASSWORD. Back up the volume first.",
  );
const users = sql(
  "SELECT * FROM platform_users WHERE lower(email)=lower(?)",
).all(email);
if (users.length !== 1)
  throw new Error(
    "The intended owner must first sign in with Google and have one matching account.",
  );
const name = getSetting("store").name;
const tables = [
  "settings",
  "products",
  "visits",
  "events",
  "orders",
  "order_history",
  "discounts",
  "subscribers",
  "variant_lookup",
];
const store = provision(
  users[0],
  { name, slug, template: "atelier", password },
  () => {
    for (const table of [...tables].reverse())
      db.prepare(`DELETE FROM ${table}`).run();
    for (const table of tables) {
      const columns = rawDb
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((x) => x.name);
      const insert = db.prepare(
        `INSERT INTO ${table}(${columns.map((c) => '"' + c + '"').join(",")}) VALUES(${columns.map(() => "?").join(",")})`,
      );
      for (const row of rawDb.prepare(`SELECT * FROM ${table}`).iterate())
        insert.run(...columns.map((c) => row[c]));
    }
    setSetting("template", { id: "atelier", version: 1, renderer: "boutique" });
    setPassword(password);
  },
);
console.log(
  JSON.stringify({
    imported: true,
    url: store.url,
    adminUrl: store.adminUrl,
    originalTablesPreserved: true,
  }),
);
rawDb.close();
