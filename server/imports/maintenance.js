import { readdir, stat, rm } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "../db.js";
import { sql } from "../platform/core.js";
export async function cleanupImports() {
  const now = Date.now(),
    dir = path.join(dataDir, "import-staging");
  try {
    for (const name of await readdir(dir)) {
      if (!/^[a-f0-9-]{36}$/.test(name)) continue;
      const job = sql(
        "SELECT state,updated FROM platform_import_jobs WHERE id=?",
      ).get(name);
      if (job && ["importing", "queued", "scanning"].includes(job.state))
        continue;
      const file = path.join(dir, name);
      if (now - (await stat(file)).mtimeMs > 7 * 86400000)
        await rm(file, { recursive: true, force: true });
    }
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const stale = sql(
    "SELECT id FROM platform_import_jobs WHERE updated<? AND state IN ('ready','partial','failed','cancelled')",
  ).all(now - 30 * 86400000);
  for (const row of stale) {
    sql("DELETE FROM platform_import_items WHERE job_id=?").run(row.id);
    sql("DELETE FROM platform_import_jobs WHERE id=?").run(row.id);
  }
  sql("DELETE FROM platform_import_oauth WHERE expires<?").run(now);
}
