import { resolveBrand } from "../data/brand.js";

export function hexToHsl(hex) {
  const [r, g, b] = hex.match(/[a-f\d]{2}/gi).map((v) => parseInt(v, 16) / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (d) {
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return `${Math.round(h * 60)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
export function luminance(hex) {
  const rgb = hex.match(/[a-f\d]{2}/gi).map((v) => {
    const n = parseInt(v, 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
export function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
export function brandTokens(value = {}) {
  const b = resolveBrand(value);
  const primary = hexToHsl(b.primary);
  const ink =
    contrast(b.primary, "#ffffff") >= contrast(b.primary, "#000000")
      ? "0 0% 100%"
      : "0 0% 0%";
  return {
    "--button-background": hexToHsl(b.button),
    "--button-foreground":
      contrast(b.button, "#302c27") >= 4.5
        ? "33 10% 17%"
        : contrast(b.button, "#ffffff") >= 4.5
          ? "0 0% 100%"
          : "0 0% 0%",
    "--primary": primary,
    "--primary-dark": primary,
    "--primary-foreground": ink,
    "--background": hexToHsl(b.background),
    "--foreground": hexToHsl(b.foreground),
    "--card": hexToHsl(b.surface),
    "--card-foreground": hexToHsl(b.foreground),
    "--popover": hexToHsl(b.surface),
    "--popover-foreground": hexToHsl(b.foreground),
    "--muted": hexToHsl(b.background),
    "--muted-foreground": hexToHsl(b.muted),
    "--secondary": hexToHsl(b.background),
    "--secondary-foreground": hexToHsl(b.foreground),
    "--accent": primary,
    "--accent-foreground": hexToHsl(b.foreground),
    "--ring": primary,
    "--brand-radius": b.radius === "sharp" ? "2px" : "12px",
    "--brand-heading":
      b.headingStyle === "sans" ? "var(--font-body)" : "var(--font-heading)",
  };
}
