import { productSeedTranslation } from "../../src/i18n/content.js";
import { defaultSettings } from "../../src/data/settings.js";
import { catalogue } from "../../src/data/products.js";
import { formSettings } from "../../src/data/form.js";
import { formDemoProducts } from "../../src/data/form-demo.js";
// Add a versioned manifest here and register its matching UI renderer in src/templates/registry.jsx.
export const templateRegistry = [
  {
    id: "atelier",
    version: 1,
    name: "The Atelier",
    nameAr: "أتيليه",
    description: "An editorial boutique for considered brands.",
    descriptionAr: "بوتيك بتفاصيل تحريرية لعلامة لها شخصيتها.",
    image: "/platform/assets/storefront.png",
    renderer: "boutique",
    languages: ["ar", "en"],
    settings: defaultSettings,
    products: catalogue.map((p) => ({
      ...p,
      translations: p.translations || { ar: productSeedTranslation(p) },
    })),
  },
  {
    id: "form",
    version: 5,
    name: "FORM",
    nameAr: "فورم",
    description:
      "A modern storefront for everyday brands. Bold imagery, considered details, and room to grow.",
    descriptionAr:
      "متجر عصري لعلامتك، بصور مميزة وتفاصيل مدروسة وتجربة تسوق متكاملة.",
    image: "/platform/assets/form-storefront.png",
    renderer: "form",
    languages: ["ar", "en"],
    settings: formSettings,
    products: [],
    previewProducts: formDemoProducts,
  },
];
for (const template of templateRegistry) {
  if (
    !/^[a-z][a-z0-9-]+$/.test(template.id) ||
    !template.renderer ||
    !template.settings ||
    !Array.isArray(template.products)
  )
    throw new Error("Invalid template manifest");
}
if (new Set(templateRegistry.map((t) => t.id)).size !== templateRegistry.length)
  throw new Error("Duplicate template identity");
export const publicTemplates = templateRegistry.map(
  ({ settings, products, previewProducts, ...manifest }) => manifest,
);
