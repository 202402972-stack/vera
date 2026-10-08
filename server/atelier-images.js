import { atelierOriginalImages } from "../src/data/products.js";
import { productsAll, writeProduct, transaction } from "./db.js";
export function migrateAtelierImages() {
  transaction(() => {
    for (const p of productsAll()) {
      const old = atelierOriginalImages[p.id];
      if (!old) continue;
      const image = "/assets/atelier-" + p.id + ".jpg";
      let changed = false;
      if (p.image === old) {
        p.image = image;
        changed = true;
      }
      p.images = p.images.map((im) => {
        if (im.url !== old) return im;
        changed = true;
        return { ...im, url: image };
      });
      p.variants = p.variants.map((v) => {
        if (v.image_url !== old) return v;
        changed = true;
        return { ...v, image_url: image };
      });
      if (changed) writeProduct(p);
    }
  });
}
