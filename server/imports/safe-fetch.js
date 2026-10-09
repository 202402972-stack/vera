import dns from "node:dns/promises";
import net from "node:net";
import { fetch, ProxyAgent, Agent } from "undici";
export function publicAddress(ip) {
  if (net.isIP(ip) === 4) {
    const n = ip.split(".").map(Number);
    return !(
      n[0] === 0 ||
      n[0] === 10 ||
      n[0] === 127 ||
      n[0] >= 224 ||
      (n[0] === 169 && n[1] === 254) ||
      (n[0] === 172 && n[1] >= 16 && n[1] <= 31) ||
      (n[0] === 192 && (n[1] === 168 || n[1] === 0 || n[1] === 2)) ||
      (n[0] === 100 && n[1] >= 64 && n[1] <= 127) ||
      (n[0] === 198 && (n[1] === 18 || n[1] === 19 || n[1] === 51)) ||
      (n[0] === 203 && n[1] === 0 && n[2] === 113)
    );
  }
  if (net.isIP(ip) === 6) {
    const s = ip.toLowerCase();
    return (
      /^2[0-9a-f]{3}:/.test(s) &&
      !s.startsWith("2001:db8:") &&
      !s.startsWith("2002:") &&
      !s.startsWith("2001:0:")
    );
  }
  return false;
}
export async function validateDestination(input, lookup = dns.lookup) {
  const url = new URL(input);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw Error("SOURCE_UNSAFE_URL");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    (!host.includes(".") && !net.isIP(host))
  )
    throw Error("SOURCE_PRIVATE_ADDRESS");
  const addresses = net.isIP(host)
    ? [{ address: host, family: net.isIP(host) }]
    : await lookup(host, { all: true, verbatim: true }).catch((e) => {
        const error = Error("SOURCE_DNS_UNAVAILABLE");
        error.retryable = ["EAI_AGAIN", "ETIMEOUT"].includes(e.code);
        throw error;
      });
  if (!addresses.length || addresses.some((r) => !publicAddress(r.address)))
    throw Error("SOURCE_PRIVATE_ADDRESS");
  return { url, addresses };
}
export async function safeFetch(
  input,
  {
    maxBytes = 10 * 1024 * 1024,
    types = ["application/json"],
    signal,
    headers = {},
    method = "GET",
    body,
    transport = fetch,
    lookup = dns.lookup,
  } = {},
) {
  let url = new URL(input);
  const timeout = AbortSignal.timeout(15000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const networkError = (e) => {
    if (
      !signal?.aborted &&
      (timeout.aborted ||
        [
          "UND_ERR_CONNECT_TIMEOUT",
          "UND_ERR_HEADERS_TIMEOUT",
          "ECONNRESET",
          "ETIMEDOUT",
          "EAI_AGAIN",
        ].includes(e.cause?.code || e.code))
    ) {
      const error = Error(
        timeout.aborted ? "SOURCE_TIMEOUT" : "SOURCE_NETWORK_UNAVAILABLE",
      );
      error.retryable = true;
      return error;
    }
    return e;
  };
  for (let redirects = 0; redirects <= 5; redirects++) {
    let abort;
    const aborted = new Promise((_, reject) => {
      abort = () => reject(combined.reason);
      if (combined.aborted) abort();
      else combined.addEventListener("abort", abort, { once: true });
    });
    let checked;
    try {
      checked = await Promise.race([
        validateDestination(url.href, lookup),
        aborted,
      ]);
    } catch (e) {
      throw networkError(e);
    } finally {
      combined.removeEventListener("abort", abort);
    }
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    // In proxy mode the managed sidecar resolves and enforces the destination. Direct mode pins validated DNS results.
    const dispatcher = proxy
      ? new ProxyAgent({ uri: proxy })
      : new Agent({
          connect: {
            lookup: (_host, options, cb) => {
              const a = checked.addresses[0];
              cb(null, options.all ? [a] : a.address, a.family);
            },
          },
        });
    try {
      const response = await transport(url, {
        dispatcher,
        redirect: "manual",
        signal: combined,
        headers,
        method,
        body,
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const next = new URL(response.headers.get("location"), url);
        if (method !== "GET" || body) {
          await response.body?.cancel();
          throw Error("SOURCE_AUTH_REDIRECT_REJECTED");
        }
        if (next.origin !== url.origin) headers = {};
        url = next;
        await response.body?.cancel();
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        const error = Error(
          response.status === 401 || response.status === 403
            ? "SOURCE_REQUIRES_ACCESS"
            : response.status === 429
              ? "SOURCE_RATE_LIMIT"
              : "SOURCE_HTTP_" + response.status,
        );
        error.retryable = [429, 502, 503, 504].includes(response.status);
        const retry = response.headers.get("retry-after");
        error.retryAfter = Math.min(
          300000,
          Math.max(
            1000,
            /^\d+$/.test(retry || "")
              ? Number(retry) * 1000
              : Date.parse(retry) - Date.now() || 5000,
          ),
        );
        throw error;
      }
      const type = (response.headers.get("content-type") || "")
        .split(";")[0]
        .trim();
      if (!types.includes(type)) {
        await response.body?.cancel();
        throw Error("SOURCE_INVALID_TYPE");
      }
      if (Number(response.headers.get("content-length")) > maxBytes) {
        await response.body?.cancel();
        throw Error("SOURCE_TOO_LARGE");
      }
      let bytes = 0;
      const chunks = [];
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > maxBytes) throw Error("SOURCE_TOO_LARGE");
        chunks.push(chunk);
      }
      return { buffer: Buffer.concat(chunks), type, url: url.href };
    } catch (e) {
      throw networkError(e);
    } finally {
      await dispatcher.close();
    }
  }
  throw Error("SOURCE_TOO_MANY_REDIRECTS");
}
