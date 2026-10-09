import { createHash } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { validateProduct } from "../validation.js";
export const supportedCurrencies = ["USD", "EGP", "EUR", "GBP", "SAR", "AED"];
export const sourceKey = (p) =>
  createHash("sha256")
    .update(`${p.sourceType}|${p.domain}|${p.externalId}`)
    .digest("hex");
export function reviewProduct(p) {
  const issues = [];
  if (!p.title || p.title.length > 90)
    issues.push("TITLE_REQUIRED_OR_TOO_LONG");
  if (!supportedCurrencies.includes(p.currency))
    issues.push("CURRENCY_REQUIRED_OR_UNSUPPORTED");
  if (
    !p.priceCurrencyReviewed &&
    p.variants?.some((v) => v.sourceCurrency && v.sourceCurrency !== p.currency)
  )
    issues.push("MIXED_SOURCE_CURRENCIES");
  if (!p.variants?.length || p.variants.length > 40)
    issues.push("UNSUPPORTED_VARIANT_COUNT");
  if (!p.images?.length || p.images.length > 12)
    issues.push("IMAGE_COUNT_REVIEW");
  if (
    p.variants?.some(
      (v) =>
        v.priceMinor === null ||
        !Number.isSafeInteger(v.priceMinor) ||
        v.priceMinor < 0,
    )
  )
    issues.push("PRICE_REQUIRED");
  if (
    p.variants?.some(
      (v) =>
        !v.stockKnown ||
        (!v.unlimited &&
          (!Number.isSafeInteger(v.stock) || v.stock < 0 || v.stock > 1000000)),
    )
  )
    issues.push("INVENTORY_REVIEW_REQUIRED");
  if (
    p.images?.some((image) => {
      try {
        const url = new URL(image);
        return (
          !["http:", "https:"].includes(url.protocol) ||
          !!url.username ||
          !!url.password
        );
      } catch {
        return true;
      }
    })
  )
    issues.push("IMAGE_URL_REVIEW_REQUIRED");
  if ((p.category || "").length > 40) issues.push("CATEGORY_TOO_LONG");
  if (p.variants?.some((v) => v.optionValues?.length > 3))
    issues.push("UNSUPPORTED_OPTION_COUNT");
  return [...new Set(issues)];
}
export function toVera(p, images) {
  const key = sourceKey(p).slice(0, 24),
    id = "import-" + key;
  const problems = reviewProduct(p);
  if (problems.length) throw Error(problems.join(", "));
  return validateProduct({
    id,
    title: p.title,
    category: p.category || "",
    description: sanitizeHtml(p.description || "", {
      allowedTags: ["p", "br", "b", "strong", "em", "i", "ul", "ol", "li"],
      allowedAttributes: {},
    }),
    status: "draft",
    purchasable: true,
    images: images.map((url) => ({ url })),
    variants: p.variants.map((v, i) => ({
      id: id + "-" + i,
      title: v.title || "Default",
      sku: v.sku || "",
      price_in_cents: v.priceMinor,
      currency: p.currency,
      currency_info: {
        code: p.currency,
        symbol: p.currency,
        decimal_digits: 2,
      },
      manage_inventory: !v.unlimited,
      inventory_quantity: v.unlimited ? null : v.stock,
      optionValues: v.optionValues || [],
    })),
    translations:
      p.locale === "ar"
        ? { ar: { title: p.title, description: p.description || "" } }
        : {},
  });
}
