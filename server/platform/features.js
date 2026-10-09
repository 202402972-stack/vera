import { platformSetting, setPlatformSetting } from "./core.js";
export const featureNames = [
  "workspace",
  "importCsv",
  "importUrl",
  "providerConnectors",
  "displayPricing",
];
export function features() {
  const saved = platformSetting("ecosystemFeatures", {});
  return Object.fromEntries(
    featureNames.map((name) => [
      name,
      process.env[
        "VERA_FEATURE_" + name.replace(/([A-Z])/g, "_$1").toUpperCase()
      ] !== "0" && saved[name] !== false,
    ]),
  );
}
export function saveFeatures(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Object.keys(value).some(
      (k) => !featureNames.includes(k) || typeof value[k] !== "boolean",
    )
  )
    throw Error("Invalid feature flags.");
  setPlatformSetting("ecosystemFeatures", value);
}
export const featureGate = (name) => (req, res, next) =>
  features()[name]
    ? next()
    : res
        .status(503)
        .json({ error: "FEATURE_TEMPORARILY_UNAVAILABLE", feature: name });
