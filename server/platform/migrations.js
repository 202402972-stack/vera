import { rawDb } from "../db.js";
// Recorded only after all additive module schemas have loaded successfully.
export const ecosystemMigrations = [
  "2026-10-09-publication-and-session-bridges",
  "2026-10-09-onboarding-and-events",
  "2026-10-09-imports-connections-and-mappings",
  "2026-10-09-plan-snapshots",
  "2026-10-09-custom-domain-claims",
];
export function recordMigrations() {
  rawDb.exec(
    "CREATE TABLE IF NOT EXISTS platform_schema_migrations(id TEXT PRIMARY KEY,applied_at INTEGER NOT NULL)",
  );
  const statement = rawDb.prepare(
    "INSERT OR IGNORE INTO platform_schema_migrations VALUES(?,?)",
  );
  for (const id of ecosystemMigrations) statement.run(id, Date.now());
}
