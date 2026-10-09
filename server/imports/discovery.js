import { safeFetch } from "./safe-fetch.js";
// Public structured data only. No scripts are executed and protected pages are never bypassed.
export function structuredProducts(html, base) {
  const found = [];
  const visit = (x, depth = 0) => {
    if (!x || depth > 8) return;
    if (Array.isArray(x)) {
      x.forEach((v) => visit(v, depth + 1));
      return;
    }
    if (typeof x !== "object") return;
    if ([x["@type"]].flat().includes("Product")) {
      const offers = [x.offers]
        .flat()
        .filter(Boolean)
        .flatMap((o) => o.offers || [o]);
      const images = [x.image]
        .flat()
        .filter(Boolean)
        .map((i) => (typeof i === "string" ? i : i.url))
        .filter(Boolean)
        .map((i) => new URL(i, base).href);
      const sourceUrl = new URL(x.url || base, base).href;
      found.push({
        sourceType: "structured-data",
        domain: new URL(base).hostname,
        externalId: String(x.productID || x.sku || sourceUrl),
        sourceUrl,
        title: String(x.name || ""),
        description: String(x.description || ""),
        category: String(x.category || ""),
        currency: offers[0]?.priceCurrency || null,
        locale: "en",
        images,
        variants: offers.map((o, i) => ({
          externalId: String(o.sku || i),
          title: String(o.name || "Default"),
          sku: String(o.sku || x.sku || ""),
          priceMinor: /^\d+(\.\d{1,2})?$/.test(String(o.price))
            ? Math.round(Number(o.price) * 100)
            : null,
          optionValues: [],
          stockKnown: false,
          stock: null,
        })),
        warnings: [
          "PUBLIC_SOURCE_MAY_BE_PARTIAL",
          "INVENTORY_NOT_PUBLIC",
          "STRUCTURED_DATA_REVIEW_REQUIRED",
        ],
      });
    } else {
      for (const [key, value] of Object.entries(x))
        if (["@graph", "mainEntity", "itemListElement", "item"].includes(key))
          visit(value, depth + 1);
    }
  };
  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      visit(JSON.parse(match[1]));
    } catch {
      /* malformed JSON-LD is reported as missing data, never evaluated */
    }
  }
  return found;
}
export async function discoverPublicProducts(source, { signal } = {}) {
  const origin = new URL(source).origin,
    products = new Map(),
    links = new Set(),
    sitemaps = [origin + "/sitemap.xml"];
  let pages = 0;
  const addHtml = (html, url) => {
    for (const p of structuredProducts(html, url))
      products.set(p.externalId, p);
    for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
      try {
        const u = new URL(m[1], url);
        if (
          u.origin === origin &&
          /\/(products?|shop)\//.test(u.pathname) &&
          links.size < 50
        )
          links.add(u.href);
      } catch {
        /* invalid link */
      }
    }
  };
  const home = await safeFetch(source, { signal, types: ["text/html"] });
  addHtml(home.buffer.toString("utf8"), home.url);
  pages++;
  for (let index = 0; index < sitemaps.length && index < 10; index++) {
    try {
      const xml = await safeFetch(sitemaps[index], {
        signal,
        types: ["application/xml", "text/xml", "text/plain"],
      });
      pages++;
      const text = xml.buffer.toString("utf8");
      for (const m of text.matchAll(
        /<loc>\s*(?:<!\[CDATA\[)?([^<]+?)(?:\]\]>)?\s*<\/loc>/gi,
      )) {
        const u = new URL(m[1].replaceAll("&amp;", "&"), origin);
        if (u.origin !== origin) continue;
        if (
          text.includes("<sitemapindex") &&
          sitemaps.length < 10 &&
          !sitemaps.includes(u.href)
        )
          sitemaps.push(u.href);
        else if (links.size < 50) links.add(u.href);
      }
    } catch (e) {
      if (e.message === "SOURCE_REQUIRES_ACCESS") throw e;
    }
  }
  for (const url of links) {
    const r = await safeFetch(url, { signal, types: ["text/html"] });
    pages++;
    addHtml(r.buffer.toString("utf8"), r.url);
  }
  if (!products.size)
    throw Error("SOURCE_NO_PUBLIC_PRODUCTS_USE_CSV_OR_CONNECTION");
  return { products: [...products.values()], pages };
}
