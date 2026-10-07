import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "vera-browser-"));
process.env.NODE_ENV = "test";
process.env.PLATFORM_MODE = "1";
process.env.OWNER_EMAILS = "owner@example.test";
process.env.PUBLIC_URL = "http://127.0.0.1:3300";
process.env.GOOGLE_CLIENT_ID = "test-client";
process.env.GOOGLE_CLIENT_SECRET = "test-secret";
const { app } = await import("../../server/platform/app.js");
const { sql, hash, provision } = await import("../../server/platform/core.js");
const { rawDb } = await import("../../server/db.js");
for (const [sub, email] of [
  ["alice", "owner@example.test"],
  ["bob", "bob@example.test"],
]) {
  sql("INSERT INTO platform_users(sub,email,name,created) VALUES(?,?,?,?)").run(
    sub,
    email,
    sub === "alice" ? "Mariam Hassan" : "Omar Ali",
    Date.now(),
  );
  const u = sql("SELECT * FROM platform_users WHERE sub=?").get(sub);
  sql("INSERT INTO platform_sessions(hash,user_id,expires) VALUES(?,?,?)").run(
    hash("fixture-" + sub),
    u.id,
    Date.now() + 86400000,
  );
  provision(u, {
    name: sub === "alice" ? "Maison Véra" : "Second House",
    slug: sub === "alice" ? "maison-vera" : "second-house",
    template: "atelier",
    password: "test-private-password-123",
  });
}
const server = app.listen(3300, "127.0.0.1");
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      rawDb.close();
      rmSync(process.env.DATA_DIR, { recursive: true, force: true });
      process.exit(0);
    }),
  );
