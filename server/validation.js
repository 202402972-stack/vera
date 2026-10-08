import { resolveBrand, defaultCommerce } from "../src/data/brand.js";
import { contrast } from "../src/lib/brand.js";
import { catalogue } from "../src/data/products.js";
const seedImages = new Set(
  catalogue.flatMap((p) => p.images.map((i) => i.url)),
);
import sanitizeHtml from "sanitize-html";

export class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function text(value, label, max = 500, required = true) {
  if (typeof value !== "string") throw new HttpError(`${label} must be text.`);
  const clean = value.trim();
  if ((required && !clean) || clean.length > max)
    throw new HttpError(
      `${label} is required and must be at most ${max} characters.`,
    );
  return clean;
}
export function money(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100000000)
    throw new HttpError(
      `${label} must be a non-negative amount, with at most two decimal places.`,
    );
  return value;
}
export function imageUrl(value) {
  const clean = text(value, "Image", 100000, true);
  if (
    /^\/uploads\/[a-f0-9-]+\.webp$/.test(clean) ||
    /^\/assets\/[a-zA-Z0-9_.-]+$/.test(clean) ||
    seedImages.has(clean)
  )
    return clean;
  throw new HttpError("Upload an image using the image picker.");
}
const html = (value) =>
  sanitizeHtml(text(value, "Description", 12000, false), {
    allowedTags: ["p", "br", "b", "strong", "em", "i", "ul", "ol", "li"],
    allowedAttributes: {},
  });
export function validateProduct(input, existingIds = new Set()) {
  if (
    !input ||
    !Array.isArray(input.variants) ||
    !input.variants.length ||
    input.variants.length > 40 ||
    input.variants.some((v) => !v || typeof v !== "object" || Array.isArray(v))
  )
    throw new HttpError("Provide between 1 and 40 styles/variants.");
  if (!["draft", "published"].includes(input.status))
    throw new HttpError("Invalid product status.");
  const id = text(input.id, "Product ID", 100);
  if (!/^[a-z0-9-]+$/.test(id))
    throw new HttpError(
      "Product ID must use lowercase letters, numbers and hyphens.",
    );
  const ids = new Set();
  const currency = text(input.variants[0].currency, "Currency", 3);
  if (!/^[A-Z]{3}$/.test(currency))
    throw new HttpError("Currency must be a three-letter code such as USD.");
  const symbol = text(
    input.variants[0].currency_info?.symbol || currency,
    "Currency symbol",
    8,
  );
  const variants = input.variants.map((v) => {
    const variantId = text(v.id, "Style ID", 120);
    if (
      !/^[a-z0-9-]+$/.test(variantId) ||
      ids.has(variantId) ||
      existingIds.has(variantId)
    )
      throw new HttpError(
        "Style IDs must be unique lowercase letters, numbers and hyphens.",
      );
    ids.add(variantId);
    const price = money(v.price_in_cents, "Price");
    const sale =
      v.sale_price_in_cents == null
        ? null
        : money(v.sale_price_in_cents, "Sale price");
    if (sale != null && sale > price)
      throw new HttpError("Sale price cannot exceed the regular price.");
    const stock = v.manage_inventory
      ? money(v.inventory_quantity, "Stock")
      : null;
    if (
      v.attributes != null &&
      (typeof v.attributes !== "object" || Array.isArray(v.attributes))
    )
      throw new HttpError("Variant attributes must be an object.");
    const attributes = Object.fromEntries(
      ["color", "size", "material"]
        .filter((k) => v.attributes?.[k] !== undefined)
        .map((k) => {
          const value = text(v.attributes[k], k, 60, false);
          if (value.includes("|"))
            throw new HttpError("Variant attributes cannot contain |.");
          return [k, value];
        }),
    );
    return {
      id: variantId,
      title: text(v.title, "Style name", 60),
      price_in_cents: price,
      sale_price_in_cents: sale,
      currency,
      currency_info: { code: currency, symbol, decimal_digits: 2 },
      manage_inventory: !!v.manage_inventory,
      inventory_quantity: stock,
      image_url: v.image_url ? imageUrl(v.image_url) : null,
      options: [],
      sku: text(v.sku || "", "SKU", 100, false),
      optionValues: (() => {
        if (v.optionValues === undefined) return [];
        if (
          !Array.isArray(v.optionValues) ||
          v.optionValues.length > 3 ||
          v.optionValues.some(
            (o) => !o || typeof o !== "object" || Array.isArray(o),
          )
        )
          throw new HttpError("Provide up to three named option values.");
        const options = v.optionValues.map((o) => ({
          name: text(o.name, "Option name", 40),
          value: text(o.value, "Option value", 60),
        }));
        if (new Set(options.map((o) => o.name)).size !== options.length)
          throw new HttpError("Option names must be unique in each variant.");
        return options;
      })(),
      attributes,
    };
  });
  const optionNames = [
    ...new Set(variants.flatMap((v) => v.optionValues.map((o) => o.name))),
  ].sort();
  if (optionNames.length) {
    if (
      variants.some(
        (v) =>
          v.optionValues.length !== optionNames.length ||
          optionNames.some(
            (name) => !v.optionValues.some((o) => o.name === name),
          ),
      )
    )
      throw new HttpError("Use the same option names in every variant.");
    const combinations = variants.map((v) =>
      JSON.stringify(
        optionNames.map(
          (name) => v.optionValues.find((o) => o.name === name).value,
        ),
      ),
    );
    if (new Set(combinations).size !== combinations.length)
      throw new HttpError("Each option combination must be unique.");
  }
  if (
    !Array.isArray(input.images) ||
    !input.images.length ||
    input.images.length > 12 ||
    input.images.some(
      (image) => !image || typeof image !== "object" || Array.isArray(image),
    )
  )
    throw new HttpError("Provide 1–12 product images.");
  if (
    input.additional_info &&
    (!Array.isArray(input.additional_info) ||
      input.additional_info.length > 20 ||
      input.additional_info.some(
        (info) => !info || typeof info !== "object" || Array.isArray(info),
      ))
  )
    throw new HttpError("Provide at most 20 detail blocks.");
  return {
    id,
    category: text(input.category || "", "Category", 60, false),
    translations: productTranslations(input.translations, variants),
    title: text(
      input.title || input.translations?.ar?.title,
      "Product name",
      90,
    ),
    subtitle: text(input.subtitle || "", "Subtitle", 150, false),
    ribbon_text: text(input.ribbon_text || "", "Badge", 24, false),
    description: html(input.description || ""),
    image: imageUrl(input.images[0].url),
    images: input.images.map((i) => ({ url: imageUrl(i.url) })),
    purchasable: !!input.purchasable,
    status: input.status === "draft" ? "draft" : "published",
    variants,
    options: [],
    merchandising: Object.fromEntries(
      ["relatedIds", "bundleIds", "recommendedIds"].map((k) => [
        k,
        Array.isArray(input.merchandising?.[k])
          ? [...new Set(input.merchandising[k])].slice(0, 20).map((id) => {
              if (typeof id !== "string" || !/^[a-z0-9-]{1,100}$/.test(id))
                throw new HttpError("Invalid product selection.");
              return id;
            })
          : [],
      ]),
    ),
    additional_info: (input.additional_info || []).map((info, i) => ({
      id: `${id}-info-${i}`,
      order: i,
      title: text(info.title, "Detail heading", 60),
      description: html(info.description),
    })),
  };
}
export function safeLink(value) {
  const clean = text(value, "Link", 500);
  if (
    /^\/(?!\/)/.test(clean) &&
    !clean.includes("\\") &&
    !/[\u0000-\u001f]/.test(clean)
  )
    return clean;
  try {
    const url = new URL(clean);
    if (["https:", "http:", "mailto:", "tel:"].includes(url.protocol))
      return clean;
  } catch {}
  throw new HttpError("Links must begin with /, https://, mailto: or tel:.");
}
export function validateSettings(s) {
  if (s?.form != null) {
    if (typeof s.form !== "object" || Array.isArray(s.form))
      throw new HttpError("FORM settings must be an object.");
    for (const key of ["heroPosition", "mobilePosition"]) {
      if (
        typeof s.form[key] !== "number" ||
        !Number.isFinite(s.form[key]) ||
        s.form[key] < 0 ||
        s.form[key] > 100
      )
        throw new HttpError(
          "Image positions must be numbers between 0 and 100.",
        );
    }
  }
  if (
    !s?.hero ||
    !s.story ||
    !s.footer ||
    !s.collection ||
    !s.checkout ||
    !s.pages
  )
    throw new HttpError("Store settings are incomplete.");
  const currency = text(s.checkout.currency, "Currency", 3);
  if (!/^[A-Z]{3}$/.test(currency))
    throw new HttpError("Use a three-letter currency code.");
  if (
    !Intl.supportedValuesOf("currency").includes(currency) ||
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits !== 2
  )
    throw new HttpError(
      "Choose a supported currency with two decimal places, such as USD, EUR, EGP, SAR or AED.",
    );
  const links = (value, label) => {
    if (
      !Array.isArray(value) ||
      value.length > 12 ||
      value.some(
        (link) => !link || typeof link !== "object" || Array.isArray(link),
      )
    )
      throw new HttpError(`${label}: at most 12 links.`);
    return value.map((link) => ({
      label: text(link.label, "Link label", 40),
      path: safeLink(link.path),
    }));
  };
  const email = text(s.footer.email, "Contact email", 200, false);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpError("Enter a valid contact email.");
  return {
    brand: validateBrand(s.brand),
    ...(s.form
      ? {
          form: {
            heroPosition: Math.max(
              0,
              Math.min(100, Number(s.form.heroPosition) || 0),
            ),
            mobilePosition: Math.max(
              0,
              Math.min(100, Number(s.form.mobilePosition) || 0),
            ),
            campaignImage: s.form.campaignImage
              ? imageUrl(s.form.campaignImage)
              : "",
            campaignEnabled: s.form.campaignEnabled === true,
            categoriesEnabled: s.form.categoriesEnabled === true,
            arrivalsEnabled: s.form.arrivalsEnabled !== false,
          },
        }
      : {}),
    commerce: validateCommerce(s.commerce),
    translations: settingsTranslations(s.translations),
    name: text(s.name, "Store name", 65),
    tagline: text(s.tagline, "Tagline", 120, false),
    metaDescription: text(s.metaDescription, "Search description", 300, false),
    hero: {
      title: text(s.hero.title, "Hero heading", 100),
      text: text(s.hero.text, "Hero caption", 650),
      image: imageUrl(s.hero.image),
      alt: text(s.hero.alt, "Image description", 200),
      button: text(s.hero.button, "Hero button", 30),
    },
    story: {
      title: text(s.story.title, "Story heading", 80),
      text: text(s.story.text, "Story", 2400),
    },
    collection: {
      title: text(s.collection.title, "Collection heading", 80),
      text: text(s.collection.text, "Collection caption", 250),
    },
    footer: {
      text: text(s.footer.text, "Footer caption", 500),
      email,
      phone: text(s.footer.phone, "Phone", 60, false),
      location: text(s.footer.location, "Location", 200, false),
      rights: text(s.footer.rights, "Copyright text", 150),
      quickLinks: links(s.footer.quickLinks, "Quick links"),
      socials: links(s.footer.socials, "Social links"),
    },
    pages: {
      shipping: text(s.pages.shipping || "", "Shipping policy", 12000, false),
      returns: text(s.pages.returns || "", "Returns policy", 12000, false),
      privacy: text(s.pages.privacy, "Privacy policy", 12000),
      terms: text(s.pages.terms, "Terms", 12000),
    },
    checkout: {
      currency,
      symbol: text(s.checkout.symbol, "Currency symbol", 8),
      shippingInCents: money(s.checkout.shippingInCents, "Delivery fee"),
      deliveryNote: text(s.checkout.deliveryNote, "Delivery note", 500),
    },
  };
}
export function validateCustomer(c) {
  if (!c) throw new HttpError("Enter your delivery information.");
  const result = {};
  for (const [key, max] of Object.entries({
    name: 120,
    phone: 60,
    address: 400,
    city: 100,
    country: 100,
    postalCode: 30,
    region: 100,
    email: 200,
    notes: 1000,
    location: 500,
  })) {
    result[key] = text(
      c[key] || "",
      key,
      max,
      ["name", "phone", "address", "city", "country"].includes(key),
    );
  }
  if (!/^[+\d\s().-]{5,60}$/.test(result.phone))
    throw new HttpError("Enter a valid phone number.");
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))
    throw new HttpError("Enter a valid email.");
  if (
    result.location &&
    !/^https:\/\/(maps\.google\.[a-z.]+|maps\.app\.goo\.gl|www\.google\.[a-z.]+|goo\.gl|maps\.apple\.com)\//.test(
      result.location,
    )
  )
    throw new HttpError("Location must be a Google Maps or Apple Maps link.");
  return result;
}

function optionalTextFields(value, limits, rich = []) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value))
    throw new HttpError("Translations must be an object.");
  const result = {};
  for (const [key, max] of Object.entries(limits))
    if (value[key] !== undefined)
      result[key] = rich.includes(key)
        ? html(value[key])
        : text(value[key], `Arabic ${key}`, max, false);
  return result;
}
export function productTranslations(value, variants) {
  if (!value?.ar) return {};
  const source = value.ar;
  const ar = optionalTextFields(
    source,
    {
      title: 90,
      subtitle: 150,
      ribbon_text: 24,
      description: 12000,
      category: 60,
    },
    ["description"],
  );
  if (source.variants !== undefined) {
    if (
      !Array.isArray(source.variants) ||
      source.variants.length > 40 ||
      source.variants.some(
        (v) => !v || typeof v !== "object" || Array.isArray(v),
      )
    )
      throw new HttpError("Invalid Arabic styles.");
    const seen = new Set();
    ar.variants = source.variants
      .filter((v) => variants.some((x) => x.id === v.id))
      .map((v) => {
        if (seen.has(v.id))
          throw new HttpError("Arabic style IDs must be unique.");
        seen.add(v.id);
        return {
          id: v.id,
          title: text(v.title, "Arabic style name", 60, false),
        };
      });
  }
  if (source.additional_info !== undefined) {
    if (
      !Array.isArray(source.additional_info) ||
      source.additional_info.length > 20 ||
      source.additional_info.some(
        (v) => !v || typeof v !== "object" || Array.isArray(v),
      )
    )
      throw new HttpError("Invalid Arabic detail blocks.");
    ar.additional_info = source.additional_info.map((info) => ({
      title: text(info.title || "", "Arabic detail heading", 60, false),
      description: html(info.description || ""),
    }));
  }
  return { ar };
}
export function settingsTranslations(value) {
  if (!value?.ar) return {};
  const source = value.ar;
  const ar = optionalTextFields(source, {
    name: 65,
    tagline: 120,
    metaDescription: 300,
  });
  const groups = {
    hero: { title: 100, text: 650, alt: 200, button: 30 },
    story: { title: 80, text: 2400 },
    collection: { title: 80, text: 250 },
    footer: { text: 500, location: 200, rights: 150 },
    pages: { privacy: 12000, terms: 12000, shipping: 12000, returns: 12000 },
    checkout: { deliveryNote: 500 },
  };
  for (const [key, limits] of Object.entries(groups))
    if (source[key]) ar[key] = optionalTextFields(source[key], limits);
  for (const key of ["quickLinks", "socials"])
    if (source.footer?.[key] !== undefined) {
      const links = source.footer[key];
      if (
        !Array.isArray(links) ||
        links.length > 12 ||
        links.some((l) => !l || typeof l !== "object" || Array.isArray(l))
      )
        throw new HttpError("At most 12 Arabic links.");
      ar.footer ||= {};
      ar.footer[key] = links.map((l) => ({
        label: text(l.label || "", "Arabic link label", 40, false),
      }));
    }
  return { ar };
}

export function validateBrand(input = {}) {
  const b = resolveBrand(input);
  for (const key of [
    "primary",
    "button",
    "background",
    "foreground",
    "surface",
    "muted",
  ]) {
    if (typeof b[key] !== "string" || !/^#[a-fA-F0-9]{6}$/.test(b[key]))
      throw new HttpError("Choose valid six-digit brand colors.");
  }
  for (const ink of ["foreground", "muted"])
    for (const surface of ["background", "surface"])
      if (contrast(b[ink], b[surface]) < 4.5)
        throw new HttpError(
          "Text colors need at least 4.5:1 contrast against both surfaces.",
        );
  // The accent is also used for text and keyboard focus on both surfaces.
  for (const surface of ["background", "surface"])
    if (contrast(b.primary, b[surface]) < 4.5)
      throw new HttpError(
        "The accent needs at least 4.5:1 contrast against both surfaces.",
      );
  if (
    !["serif", "sans"].includes(b.headingStyle) ||
    !["soft", "sharp"].includes(b.radius)
  )
    throw new HttpError("Invalid brand style.");
  return {
    primary: b.primary,
    button: b.button,
    background: b.background,
    foreground: b.foreground,
    surface: b.surface,
    muted: b.muted,
    logo: b.logo ? imageUrl(b.logo) : "",
    headingStyle: b.headingStyle,
    radius: b.radius,
    showStory: b.showStory !== false,
    announcement: {
      enabled: b.announcement?.enabled === true,
      text: text(b.announcement?.text || "", "Announcement", 180, false),
      textAr: text(
        b.announcement?.textAr || "",
        "Arabic announcement",
        180,
        false,
      ),
      link: safeLink(b.announcement?.link || "/shop"),
    },
  };
}
export function validateCommerce(input = {}) {
  const c = { ...defaultCommerce, ...input };
  if (!Array.isArray(c.allowedCountries) || c.allowedCountries.length > 250)
    throw new HttpError("Invalid delivery countries.");
  if (
    !Number.isSafeInteger(c.taxRateBps) ||
    c.taxRateBps < 0 ||
    c.taxRateBps > 10000
  )
    throw new HttpError("Tax rate must be between 0 and 100%.");
  if (
    !Number.isSafeInteger(c.lowStockThreshold) ||
    c.lowStockThreshold < 0 ||
    c.lowStockThreshold > 10000
  )
    throw new HttpError("Invalid low-stock threshold.");
  return {
    acceptingOrders: c.acceptingOrders !== false,
    freeShippingOverInCents:
      c.freeShippingOverInCents == null
        ? null
        : money(c.freeShippingOverInCents, "Free shipping threshold"),
    minimumOrderInCents: money(c.minimumOrderInCents, "Minimum order"),
    lowStockThreshold: c.lowStockThreshold,
    allowedCountries: [
      ...new Set(
        c.allowedCountries
          .filter((v) => typeof v !== "string" || v.trim())
          .map((v) => text(v, "Country", 100)),
      ),
    ],
    taxRateBps: c.taxRateBps,
    taxLabel: text(c.taxLabel, "Tax label", 40),
    taxLabelAr: text(c.taxLabelAr, "Arabic tax label", 40),
  };
}
