// Route this Worker to the Cloudflare for SaaS custom hostnames only.
// Bind VERA_ORIGIN (https://the platform's Railway hostname) and
// DOMAIN_PROXY_SECRET (the same private value used by the VÉRA server).
export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    const origin = new URL(env.VERA_ORIGIN);
    if (origin.protocol !== "https:" || !env.DOMAIN_PROXY_SECRET)
      return new Response("Domain gateway is not configured.", { status: 503 });
    const destination = new URL(incoming.pathname + incoming.search, origin);
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("x-forwarded-host");
    headers.delete("x-vera-domain");
    headers.delete("x-vera-domain-timestamp");
    headers.delete("x-vera-domain-signature");
    if (headers.get("origin") === incoming.origin)
      headers.set("origin", origin.origin);
    const timestamp = String(Date.now());
    const payload = new TextEncoder().encode(
      `${incoming.hostname.toLowerCase()}\n${timestamp}`,
    );
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.DOMAIN_PROXY_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const bytes = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, payload),
    );
    const signature = [...bytes]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    headers.set("x-vera-domain", incoming.hostname.toLowerCase());
    headers.set("x-vera-domain-timestamp", timestamp);
    headers.set("x-vera-domain-signature", signature);
    const init = { method: request.method, headers, redirect: "manual" };
    if (!["GET", "HEAD"].includes(request.method)) init.body = request.body;
    return fetch(new Request(destination, init));
  },
};
