import { platformSetting, setPlatformSetting } from "../platform/core.js";
export const maximums = {
  products: 500,
  pages: 1000,
  images: 2000,
  imageBytes: 500 * 1024 * 1024,
  fileBytes: 10 * 1024 * 1024,
};
export const limits = {};
for (const key of Object.keys(maximums))
  Object.defineProperty(limits, key, {
    enumerable: true,
    get: () => {
      const configured = platformSetting("importLimits", {})[key];
      return Number.isSafeInteger(configured) && configured > 0
        ? Math.min(configured, maximums[key])
        : maximums[key];
    },
  });
export function validateImportLimits(value) {
  if (
    !value ||
    Array.isArray(value) ||
    typeof value !== "object" ||
    Object.keys(value).length !== Object.keys(maximums).length ||
    Object.entries(value).some(
      ([key, n]) =>
        !Object.hasOwn(maximums, key) ||
        !Number.isSafeInteger(n) ||
        n < 1 ||
        n > maximums[key],
    )
  )
    throw Error(
      "Import limits must be positive integers within the platform resource caps.",
    );
  return value;
}
export function saveImportLimits(value) {
  setPlatformSetting("importLimits", validateImportLimits(value));
}
