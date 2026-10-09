import { discoverPublicProducts } from "./discovery.js";
import { safeFetch } from "./safe-fetch.js";
export async function shopifyPage(source, page = 1, { signal } = {}) {
  const url = new URL(source);
  url.pathname = "/products.json";
  url.search = "limit=100&page=" + page;
  let r;
  try {
    r = await safeFetch(url.href, { signal });
  } catch (e) {
    if (
      page === 1 &&
      ["SOURCE_HTTP_404", "SOURCE_INVALID_TYPE"].includes(e.message)
    )
      return (await discoverPublicProducts(source, { signal })).products;
    throw e;
  }
  const data = JSON.parse(r.buffer.toString("utf8"));
  if (!Array.isArray(data.products)) throw Error("SOURCE_UNSUPPORTED");
  return data.products.map((p) => ({
    sourceType: "shopify-url",
    domain: url.hostname.toLowerCase(),
    externalId: String(p.id),
    sourceUrl: new URL("/products/" + p.handle, url).href,
    title: p.title,
    description: p.body_html || "",
    category: p.product_type || "",
    currency: null,
    locale: "en",
    images: (p.images || []).map((i) => i.src),
    variants: (p.variants || []).map((v) => ({
      externalId: String(v.id),
      title: v.title,
      sku: v.sku,
      priceMinor: /^\d+(\.\d{1,2})?$/.test(String(v.price))
        ? Math.round(Number(v.price) * 100)
        : null,
      stockKnown: false,
      stock: null,
      optionValues: (p.options || [])
        .map((o, i) => ({ name: o.name, value: v["option" + (i + 1)] }))
        .filter((o) => o.value && o.value !== "Default Title"),
    })),
    warnings: [
      "PUBLIC_SOURCE_MAY_BE_PARTIAL",
      "INVENTORY_NOT_PUBLIC",
      ...((p.variants || []).some((v) => v.requires_shipping === false)
        ? ["UNSUPPORTED_PRODUCT_TYPE"]
        : []),
    ],
  }));
}
