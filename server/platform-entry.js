process.env.PLATFORM_MODE = "1";
if (process.env.NODE_ENV === "production") {
  const url = new URL(process.env.PUBLIC_URL || "http://invalid");
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("PUBLIC_URL must be the HTTPS origin of the deployment.");
  if (!process.env.OWNER_EMAILS)
    throw new Error(
      "Set OWNER_EMAILS to the verified Google email addresses of the platform owners.",
    );
}
const { app } = await import("./platform/app.js");
const { sql } = await import("./platform/core.js");
const { inTenant } = await import("./tenant.js");
const { retryPayments } = await import("./platform/paymob.js");
const { deliverPending, stopDelivery } = await import("./telegram.js");
const server = app.listen(process.env.PORT || 3001, () =>
  console.log("VÉRA platform ready"),
);
let busy = false;
const timer = setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    for (const s of sql(
      "SELECT id,slug FROM platform_stores WHERE suspended=0",
    ).all())
      await inTenant(s.id, `/s/${s.slug}`, deliverPending);
    await retryPayments();
  } finally {
    busy = false;
  }
}, 15000);
timer.unref();
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, async () => {
    clearInterval(timer);
    server.close();
    await stopDelivery();
    server.closeAllConnections();
  });
