// Shared, validated design contract. The dashboard owns its own accessible palette.
export const brandPresets = {
  atelier: {
    name: "Warm atelier",
    primary: "#80623e",
    button: "#c0b095",
    background: "#faf8f4",
    foreground: "#302c27",
    surface: "#ffffff",
    muted: "#70675d",
  },
  forest: {
    name: "Forest house",
    primary: "#245749",
    button: "#245749",
    background: "#f6f8f4",
    foreground: "#1b3029",
    surface: "#ffffff",
    muted: "#5c7067",
  },
  noir: {
    name: "Modern noir",
    primary: "#292929",
    button: "#292929",
    background: "#f7f7f5",
    foreground: "#202020",
    surface: "#ffffff",
    muted: "#676762",
  },
  claret: {
    name: "Claret edition",
    primary: "#763b4d",
    button: "#763b4d",
    background: "#fcf7f6",
    foreground: "#34232a",
    surface: "#ffffff",
    muted: "#795f66",
  },
};
export const defaultBrand = {
  ...brandPresets.atelier,
  logo: "",
  headingStyle: "serif",
  radius: "soft",
  announcement: { enabled: false, text: "", textAr: "", link: "/shop" },
  showStory: true,
};
export const defaultCommerce = {
  freeShippingOverInCents: null,
  minimumOrderInCents: 0,
  acceptingOrders: true,
  allowedCountries: [],
  lowStockThreshold: 5,
  taxRateBps: 0,
  taxLabel: "Tax",
  taxLabelAr: "الضريبة",
};

// Older stores retain their custom accent; the original atelier regains its gold fill.
export function resolveBrand(input = {}) {
  return {
    ...defaultBrand,
    ...input,
    button:
      input.button ||
      (input.primary && input.primary !== defaultBrand.primary
        ? input.primary
        : defaultBrand.button),
  };
}
