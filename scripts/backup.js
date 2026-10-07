// Run inside the deployed container with the persistent volume mounted.
import { DatabaseSync } from "node:sqlite";
import { cpSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
const source = path.resolve(
  process.env.DATA_DIR ||
    (process.env.RAILWAY_ENVIRONMENT ? "/data" : "./data"),
);
const target = path.resolve(
  process.argv[2] ||
    `./backup-${new Date().toISOString().replaceAll(":", "-")}`,
);
if (target === source || target.startsWith(source + path.sep))
  throw new Error("Backup location must be outside the data directory.");
if (existsSync(target))
  throw new Error("Choose a new empty backup destination.");
mkdirSync(target, { recursive: true });
const db = new DatabaseSync(path.join(source, "store.sqlite"));
db.exec("PRAGMA busy_timeout=5000");
const destination = path.join(target, "store.sqlite").replaceAll("'", "''");
db.exec(`VACUUM INTO '${destination}'`);
db.close();
cpSync(path.join(source, "uploads"), path.join(target, "uploads"), {
  recursive: true,
});
cpSync(
  path.join(source, ".encryption-key"),
  path.join(target, ".encryption-key"),
);
console.log(`Complete backup written to ${target}. Keep it private.`);
