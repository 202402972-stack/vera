import { parse } from "csv-parse/sync";
export const aliases = {
  id: ["id", "ID", "Handle", "معرف"],
  title: ["title", "Title", "Name", "اسم", "الاسم"],
  description: ["description", "Body (HTML)", "Description", "الوصف"],
  image: ["image", "Image Src", "Images", "الصورة"],
  price: ["price", "Variant Price", "Regular price", "السعر"],
  currency: ["currency", "Currency", "العملة"],
  stock: ["stock", "Variant Inventory Qty", "Stock", "المخزون"],
  sku: ["sku", "Variant SKU", "SKU"],
  variantId: ["variantId", "Variant ID"],
  option1: ["option1", "Option1 Value", "Attribute 1 value(s)"],
  optionName1: ["optionName1", "Option1 Name", "Attribute 1 name"],
  option2: ["option2", "Option2 Value", "Attribute 2 value(s)"],
  optionName2: ["optionName2", "Option2 Name", "Attribute 2 name"],
  option3: ["option3", "Option3 Value", "Attribute 3 value(s)"],
  optionName3: ["optionName3", "Option3 Name", "Attribute 3 name"],
  parent: ["parent", "Parent"],
  type: ["type", "Type"],
  category: ["category", "Tags", "Categories", "التصنيف"],
};
export function csvHeaders(text) {
  const rows = parse(text, {
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    to_line: 1,
  });
  return rows[0] || [];
}
export function parseCsv(
  text,
  { mapping = {}, currency = "", locale = "en", sourceType = "csv" } = {},
) {
  const rows = parse(text, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: false,
    max_record_size: 1024 * 1024,
  });
  if (rows.length > 20000) throw Error("CSV_ROW_LIMIT");
  const get = (r, k) =>
    r[mapping[k]] ??
    aliases[k]?.map((a) => r[a]).find((v) => v !== undefined) ??
    "";
  const groups = new Map();
  let current = null;
  for (const [index, r] of rows.entries()) {
    const type = get(r, "type");
    if (/downloadable|virtual|subscription|grouped|external/i.test(type)) {
      const skipped = {
        sourceType,
        domain: "csv-file",
        externalId: String(get(r, "id") || index),
        title: get(r, "title"),
        description: "",
        category: "",
        currency: get(r, "currency") || currency,
        locale,
        images: [],
        variants: [],
        warnings: ["UNSUPPORTED_PRODUCT_TYPE"],
      };
      groups.set(skipped.externalId, skipped);
      continue;
    }
    const rawId =
      get(r, "parent") || get(r, "id") || get(r, "sku") || String(index + 1);
    const id = String(rawId).replace(/^id:/, "");
    let p = groups.get(id);
    if (!p && sourceType === "shopify-csv" && !get(r, "title") && current)
      p = current;
    if (!p) {
      p = {
        sourceType,
        domain: "csv-file",
        externalId: id,
        title: get(r, "title"),
        description: get(r, "description"),
        category: get(r, "category"),
        currency: get(r, "currency") || currency,
        locale,
        images: [],
        variants: [],
        sourceRow: index + 2,
        warnings: [],
      };
      groups.set(id, p);
      current = p;
    }
    const image = get(r, "image");
    for (const url of image.split(/\s*,\s*|\s*;\s*/).filter(Boolean))
      if (!p.images.includes(url)) p.images.push(url);
    if (["variable", "grouped", "external", "subscription"].includes(type)) {
      if (type !== "variable") p.warnings.push("UNSUPPORTED_PRODUCT_TYPE");
      continue;
    }
    if (
      sourceType === "shopify-csv" &&
      !get(r, "title") &&
      !get(r, "price") &&
      !get(r, "sku") &&
      !get(r, "stock")
    )
      continue;
    const price = get(r, "price").trim(),
      stock = get(r, "stock").trim();
    p.variants.push({
      sourceCurrency: get(r, "currency") || currency || p.currency,
      externalId: get(r, "variantId") || get(r, "sku") || String(index),
      sku: get(r, "sku"),
      title:
        [get(r, "option1"), get(r, "option2"), get(r, "option3")]
          .filter(Boolean)
          .join(" / ") || "Default",
      priceMinor: /^\d+(\.\d{1,2})?$/.test(price)
        ? Math.round(Number(price) * 100)
        : null,
      stockKnown: /^\d+$/.test(stock),
      stock: /^\d+$/.test(stock) ? Number(stock) : null,
      optionValues: [1, 2, 3]
        .filter((n) => get(r, "option" + n))
        .map((n) => ({
          name: get(r, "optionName" + n) || "Option " + n,
          value: get(r, "option" + n),
        })),
    });
  }
  return [...groups.values()];
}
