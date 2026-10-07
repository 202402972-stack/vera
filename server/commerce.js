import { stmt, productForVariant } from "./db.js";
import { HttpError, text } from "./validation.js";
import { defaultCommerce } from "../src/data/brand.js";

export function priceCart(lines) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 40)
    throw new HttpError(
      "An order must contain between 1 and 40 product lines.",
    );
  const quantities = new Map();
  for (const line of lines) {
    if (
      !line ||
      typeof line.variant_id !== "string" ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 99
    )
      throw new HttpError("Invalid product quantity.");
    quantities.set(
      line.variant_id,
      (quantities.get(line.variant_id) || 0) + line.quantity,
    );
  }
  let subtotal = 0;
  for (const [id, quantity] of quantities) {
    const product = productForVariant(id),
      variant = product?.variants.find((v) => v.id === id);
    if (!product || product.status !== "published" || !product.purchasable)
      throw new HttpError(
        "A product is no longer available. Please update your cart.",
        409,
      );
    if (
      quantity > 99 ||
      (variant.manage_inventory && quantity > variant.inventory_quantity)
    )
      throw new HttpError(
        "Some quantities are no longer available. Please update your cart.",
        409,
      );
    subtotal +=
      (variant.sale_price_in_cents ?? variant.price_in_cents) * quantity;
  }
  return subtotal;
}

// Both the quote endpoint and the order transaction use this calculation.
export function quoteTotals(store, subtotal, couponCode = "", country = "") {
  const rules = { ...defaultCommerce, ...store.commerce };
  country = text(country, "Country", 100, false);
  if (!rules.acceptingOrders)
    throw new HttpError("The store is temporarily not accepting orders.", 409);
  if (subtotal < rules.minimumOrderInCents)
    throw new HttpError("The minimum order amount has not been reached.");
  if (
    country &&
    rules.allowedCountries.length &&
    !rules.allowedCountries.some(
      (c) => c.toLowerCase() === country.trim().toLowerCase(),
    )
  )
    throw new HttpError("Delivery is not available to this country.");
  const code = text(couponCode, "Discount code", 32, false).toUpperCase();
  let coupon = null,
    discount = 0;
  if (code) {
    const row = stmt("SELECT * FROM discounts WHERE code=?").get(code);
    coupon = row ? { ...JSON.parse(row.data), used: row.used } : null;
    if (
      !coupon ||
      !coupon.active ||
      (coupon.expiresAt && Date.parse(coupon.expiresAt) <= Date.now()) ||
      (coupon.maxUses != null && coupon.used >= coupon.maxUses)
    )
      throw new HttpError(
        "This discount code is invalid or no longer available.",
      );
    if (coupon.currency !== store.checkout.currency)
      throw new HttpError(
        "This discount code is not available in the store currency.",
      );
    if (subtotal < coupon.minimumInCents)
      throw new HttpError(
        "The minimum spend for this discount has not been reached.",
      );
    discount = Math.min(
      subtotal,
      coupon.type === "percent"
        ? Math.round((subtotal * coupon.value) / 100)
        : coupon.value,
    );
  }
  const shipping =
    rules.freeShippingOverInCents != null &&
    subtotal - discount >= rules.freeShippingOverInCents
      ? 0
      : store.checkout.shippingInCents;
  // Exclusive tax on discounted merchandise. Shipping is not taxed.
  const tax = Math.round(((subtotal - discount) * rules.taxRateBps) / 10000);
  return {
    subtotal_in_cents: subtotal,
    discount_in_cents: discount,
    coupon_code: coupon ? code : null,
    shipping_in_cents: shipping,
    tax_in_cents: tax,
    tax_rate_bps: rules.taxRateBps,
    tax_label: rules.taxLabel,
    tax_label_ar: rules.taxLabelAr,
    total_in_cents: subtotal - discount + shipping + tax,
    currency: store.checkout.currency,
    symbol: store.checkout.symbol,
  };
}

export function validateDiscount(input, currency) {
  const code = text(input.code, "Discount code", 32).toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code))
    throw new HttpError(
      "Use 3–32 letters, numbers, hyphens or underscores for the discount code.",
    );
  if (!["percent", "fixed"].includes(input.type))
    throw new HttpError("Invalid discount type.");
  if (
    !Number.isSafeInteger(input.value) ||
    input.value < 1 ||
    input.value > (input.type === "percent" ? 100 : 100000000)
  )
    throw new HttpError("Enter a valid discount amount.");
  if (
    !Number.isSafeInteger(input.minimumInCents) ||
    input.minimumInCents < 0 ||
    input.minimumInCents > 100000000
  )
    throw new HttpError("Invalid minimum spend.");
  if (
    input.maxUses != null &&
    (!Number.isSafeInteger(input.maxUses) ||
      input.maxUses < 1 ||
      input.maxUses > 1000000)
  )
    throw new HttpError("Invalid usage limit.");
  if (
    input.expiresAt &&
    (!Number.isFinite(Date.parse(input.expiresAt)) ||
      typeof input.expiresAt !== "string")
  )
    throw new HttpError("Invalid expiry date.");
  return {
    code,
    type: input.type,
    value: input.value,
    minimumInCents: input.minimumInCents,
    maxUses: input.maxUses ?? null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
    active: input.active === true,
    currency,
  };
}
