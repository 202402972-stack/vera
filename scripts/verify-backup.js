// Validate a backup and boot a disposable restore. Never writes to the source backup or live volume.
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, cpSync, rmSync, statSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createDecipheriv } from "node:crypto";
import os from "node:os";
import path from "node:path";
const source = path.resolve(process.argv[2] || "");
if (!process.argv[2])
  throw Error("Usage: node scripts/verify-backup.js BACKUP_DIRECTORY");
const key = readFileSync(path.join(source, ".encryption-key"));
if (key.length !== 32) throw Error("Encryption key must be 32 bytes");
if (!statSync(path.join(source, "uploads")).isDirectory())
  throw Error("Uploads missing");
const database = new DatabaseSync(path.join(source, "store.sqlite"), {
  readOnly: true,
});
if (database.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
  throw Error("SQLite integrity check failed");
const tables = database
  .prepare("SELECT name FROM sqlite_master WHERE type='table'")
  .all();
let connections = 0;
if (tables.some((t) => t.name === "platform_import_connections"))
  for (const row of database
    .prepare(
      "SELECT secret FROM platform_import_connections WHERE secret IS NOT NULL",
    )
    .all()) {
    const b = Buffer.from(row.secret, "base64"),
      d = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString());
    connections++;
  }
const stores = tables.some((t) => t.name === "platform_stores")
  ? database.prepare("SELECT count(*) n FROM platform_stores").get().n
  : 0;
database.close();
const temporary = mkdtempSync(path.join(os.tmpdir(), "vera-restore-"));
try {
  cpSync(source, temporary, { recursive: true });
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "await import('./server/platform/app.js'); const {rawDb}=await import('./server/db.js');if(rawDb.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Restore integrity failed');rawDb.close();",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATA_DIR: temporary,
        PLATFORM_MODE: "1",
        NODE_ENV: "test",
      },
      encoding: "utf8",
      timeout: 30000,
    },
  );
  if (result.status !== 0)
    throw Error(
      "Disposable restore boot failed: " + (result.stderr || "timeout"),
    );
  console.log(
    JSON.stringify({
      ok: true,
      integrity: "ok",
      restoredStores: stores,
      encryptedConnectionsVerified: connections,
      disposableBoot: "passed",
    }),
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
