import { storeBase } from "@/lib/store-scope";
import { getLanguage } from "@/i18n/LanguageContext";
import { localizeProduct } from "@/i18n/content";
export async function api(path, options = {}) {
  const response = await fetch(`${storeBase}/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
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
    if (response.status === 401 && path !== "/admin/login")
      window.dispatchEvent(new Event("admin-session-expired"));
    const error = new Error(body.error || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return body;
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
  ids,
  search = "",
  category = "",
  collection = "",
  sort = "featured",
  signal,
} = {}) {
  const data = await api(
    ids
      ? `/products?ids=${encodeURIComponent(ids.join(","))}`
      : `/products?${new URLSearchParams({ offset, search, category, collection, sort })}`,
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
