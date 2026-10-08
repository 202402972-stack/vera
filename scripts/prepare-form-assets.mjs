// Re-encode included source images without network access or machine-specific paths.
import { fileURLToPath } from "node:url";
import sharp from "sharp";
const root = new URL("../public/assets/", import.meta.url);
for (const name of ["hero", "campaign", "jacket", "shoes", "bag", "lamp"]) {
  await sharp(fileURLToPath(new URL(`form-${name}.png`, root)))
    .webp({ quality: 88 })
    .toFile(fileURLToPath(new URL(`form-${name}.webp`, root)));
}
console.log(
  "FORM images encoded. Licensed fonts are included in public/assets.",
);
