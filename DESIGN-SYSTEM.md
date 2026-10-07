# Boutique design system

The storefront keeps the original editorial direction: warm paper, generous spacing, local serif headings, a restrained accent, a split-image hero and portrait merchandise. Merchant Studio uses a separate green/ivory palette so changing a brand never compromises dashboard legibility.

## Sources of truth

- `src/data/brand.js`: presets and defaults.
- `src/lib/brand.js`: contrast calculation and conversion into CSS tokens.
- `server/validation.js`: shared persisted brand contract, link/image validation and minimum contrast.
- `src/hooks/useStore.jsx`: publishes the validated store tokens on the document root.
- `src/admin.css`: independently scoped dashboard tokens and responsive shell.

| Role | Warm atelier | Merchant Studio |
| --- | --- | --- |
| Accent / primary | `#80623E` | `hsl(160 34% 25%)` |
| Button fill | `#C0B095` | Green primary |
| Canvas | `#FAF8F4` | `hsl(42 25% 96%)` |
| Surface | `#FFFFFF` | `#FFFFFF` |
| Main ink | `#302C27` | `hsl(160 18% 16%)` |
| Secondary ink | `#70675D` | `hsl(150 6% 40%)` |
| Navigation | Inherits brand canvas | `#172F28` |

Forest, Noir and Claret are alternative complete palettes. The server requires 4.5:1 contrast for primary and both text colors against both surfaces. Button fill is a separate editable token (`--button-background`); its foreground automatically chooses readable ink, black or white. The atelier restores the original light gold without weakening accent text contrast. Older custom palettes keep their own primary as the button fill until explicitly edited. These checks cover configured tokens, not a certification of every possible page or uploaded image.

## Typography and geometry

- English headings: Cormorant Garamond; body: Inter.
- Arabic headings: Noto Naskh Arabic; body: Noto Sans Arabic.
- All fonts are local with `font-display: swap`; English web delivery uses WOFF2. Original TTF files remain for server-rendered receipts and provenance. License files are retained.
- Heading mode can use the body font for a contemporary sans treatment.
- Store corner styles: 12px soft or 2px architectural. Dashboard cards retain a consistent 12px radius.
- Portrait product images: 800 × 1000, 4:5; hero upload: 1600 × 1800. Logos fit inside 640 × 240 without cropping or upscaling.
- Dashboard spacing: 24px cards, 38px desktop canvas gutters; reduced to 18px/14px on narrow screens. Desktop navigation is 250px. Below 1024px it becomes a compact three-column navigation grid. The header hides after downward scrolling and returns when scrolling up or using keyboard focus, with a 220ms transition that respects reduced motion.

## States and interaction

Green: active, delivered, published. Amber: new/pending and low stock. Blue: processing. Violet: shipped. Red: cancelled, failed and out of stock. Every state also has a text label.

The Merchant Studio monogram is a fixed Latin B in both languages. Login uses the store hero photograph, a forest overlay, a responsive editorial layout and a password toggle in a dedicated flex column.

Inputs retain visible labels. Keyboard focus is visible. The shopping bag and order dialogs trap focus, support Escape and restore focus to the opener. Reduced-motion preferences disable CSS motion and are honored by Framer Motion configuration. Arabic uses logical layout properties and RTL; contact details remain bidirectional isolates.

Preview is a draft until the publish action succeeds. Save controls communicate dirty state. API version conflicts never silently overwrite current settings. Loading, empty, error and unavailable states are distinct, including a recoverable initial store-loading failure.
