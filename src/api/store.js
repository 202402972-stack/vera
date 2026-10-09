import { storeBase } from "@/lib/store-scope";
import { getLanguage } from "@/i18n/LanguageContext";
import { localizeProduct } from "@/i18n/content";
export const api = createStoreApi(storeBase);
export function createStoreApi(base, storeId = null, signal) {
  return async function api(path, options = {}) {
    const response = await fetch(
      `${base}/api${path}${new URLSearchParams(window.location.search).get("preview") === "1" ? (path.includes("?") ? "&" : "?") + "preview=1" : ""}`,
      {
        credentials: "same-origin",
        ...options,
        signal:
          signal && options.signal
            ? AbortSignal.any([signal, options.signal])
            : options.signal || signal,
        headers: {
          ...(options.body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
          ...options.headers,
        },
      },
    );
    if (response.status === 204) return null;
    let body;
    try {
      body = await response.json();
    } catch (error) {
      if (error.name === "AbortError") throw error;
      throw new Error(
        "The service is temporarily unavailable. Please try again.",
      );
    }
    if (!response.ok) {
      if (
        response.status === 401 &&
        path.startsWith("/admin/") &&
        path !== "/admin/login"
      )
        window.dispatchEvent(
          new CustomEvent("admin-session-expired", { detail: { storeId } }),
        );
      const error = new Error(body.error || "Request failed.");
      error.status = response.status;
      throw error;
    }
    return body;
  };
}
export const jsonRequest = (method, body) => ({
  method,
  body: JSON.stringify(body),
});
export const formatCurrency = (priceInCents, currencyInfo) => {
  if (!currencyInfo || priceInCents === null || priceInCents === undefined)
    return "";
  const digits = Number.isInteger(currencyInfo.decimal_digits)
    ? currencyInfo.decimal_digits
    : 2;
  const amount = (priceInCents / Math.pow(10, digits)).toFixed(digits);
  return `${currencyInfo.symbol || currencyInfo.code || ""}${amount}`;
};
const withPrices = (product) => ({
  ...product,
  price_formatted: formatCurrency(
    product.variants[0].price_in_cents,
    product.variants[0].currency_info,
  ),
  variants: product.variants.map((v) => ({
    ...v,
    price_formatted: formatCurrency(v.price_in_cents, v.currency_info),
    sale_price_formatted:
      v.sale_price_in_cents == null
        ? null
        : formatCurrency(v.sale_price_in_cents, v.currency_info),
  })),
});
export async function getProducts({
  offset = 0,
  limit = 24,
  ids,
  search = "",
  category = "",
  collection = "",
  sort = "featured",
  colors = "",
  sizes = "",
  materials = "",
  min_price = "",
  max_price = "",
  in_stock = "",
  rating = "",
  signal,
} = {}) {
  const data = await api(
    ids
      ? `/products?ids=${encodeURIComponent(ids.join(","))}`
      : `/products?${new URLSearchParams({ offset, limit, search, category, collection, sort, colors, sizes, materials, min_price, max_price, in_stock, rating })}`,
    { signal },
  );
  return {
    ...data,
    products: data.products.map((p) => ({
      ...localizeProduct(withPrices(p), getLanguage()),
      _base: withPrices(p),
    })),
  };
}
export async function getProduct(id, options = {}) {
  const raw = withPrices(
    await api(`/products/${encodeURIComponent(id)}`, options),
  );
  return { ...localizeProduct(raw, getLanguage()), _base: raw };
}
export async function getProductQuantities({ product_ids }) {
  return api("/quantities", jsonRequest("POST", { product_ids }));
}
export async function initializeCheckout(order) {
  return api("/orders", jsonRequest("POST", order));
}
