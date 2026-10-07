import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "boutique-browser-"));
process.env.PORT = "3100";
process.env.NODE_ENV = "test";
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options) =>
  String(url).startsWith("https://api.telegram.org/")
    ? Promise.resolve(
        new Response(JSON.stringify({ ok: true, result: { message_id: 100 } })),
      )
    : originalFetch(url, options);
delete process.env.ADMIN_PASSWORD;
const { startServer } = await import("../../server/index.js");
const { db } = await import("../../server/db.js");
const server = startServer();
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      rmSync(process.env.DATA_DIR, { recursive: true, force: true });
      process.exit(0);
    }),
  );
