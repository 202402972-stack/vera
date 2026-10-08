# GALA reference audit — 2026-10-08

Source: https://www.banzena.com/examples/gala?page=home
This audit records the reference inspection before implementation. See ../GALA-IMPLEMENTATION.md for the implemented behavior and verification.

## Captured reference

- Home, all eight product pages, and all six collection pages: HTML, content/controls JSON and desktop screenshots.
- Mobile home, collection, filters, menu, product; desktop search, product mega menu, reviews expanded, empty cart and filled cart; filled mobile cart.
- 10 original source images downloaded successfully (200 responses), plus responsive versions and the actually loaded Albert Sans WOFF2 file. See original-assets.json and asset-manifest.json.
- gala.css is the retrieved 141050-byte reference stylesheet; scripts and inline styles are stored for behavior inspection. They are reference evidence, not a plan to embed the external application or its tracking scripts.

## Theme contract

10 primary theme color roles using 6 unique values:
- Background / on-primary: #ffffff
- Surface / footer text: #f3f0ed
- Ink / primary / footer background: #151414
- Muted: #6c6763
- Accent / sale: #c23b6b
- Border: #e6e1dc

Additional functional colors (review stars, validation, stock, social icons) are recorded in gala.css. Preserve these distinctions rather than mapping the design to VERA green brand tokens.

Albert Sans is actually loaded. Headings declare Gilda Display, Georgia, serif, but the Google Fonts response obtained for the reference contains Albert Sans only: Gilda weights requested by the reference are unavailable. Screenshot matching must account for the actual serif fallback, not silently change heading metrics by fixing the remote font request. Body font size 15px, line height 1.6; hero H1 at 1440 is 92.16px with 90.3168px line height; section heading 41.6px. Square corners, no theme shadow, 1440px maximum theme wrapper. Measure effective component styles and breakpoints from the retrieved CSS.

## Visible feature inventory

Home: split header, centered wordmark, Products and Collections mega menus, search, account/saved/cart actions, mobile overlay menu and bottom navigation; left-copy/right-collage hero; horizontally scrollable collections; category navigation; 8-product trending grid; 5-product asymmetric Shop the Look; image/story; 3 demo testimonials; four trust/service items; FAQ accordion; newsletter/footer; currency switcher.

Collection: breadcrumbs/name/count, sort (newest, price asc/desc, name asc/desc), price range, stock availability, minimum review rating; sidebar on desktop and drawer on mobile; save buttons and product cards.

Product: gallery/thumbnails, category/name/rating/prices/description, size/colour or waist/shoe size options, SKU/stock, quantity, add to cart, Buy now, sticky purchase bar, specifications table, native/social share/copy, collapsible reviews with title/name privacy/photo controls, Frequently Bought Together / add all, related products, recently viewed, recommendations, product FAQ.

Cart: drawer opens automatically after add; selected variant, image, amount, quantity/remove, total, continue shopping, checkout button, reassurance items, cross-sell rail. Source supports free-shipping progress and order notes but both are disabled in this particular reference (BZ_CART_X ship=false, note=false, up=true); keep them disabled by default.

## Limits and defects observed in the external demo

- Account, saved-items page, About/Contact/Support/Tracking/Shipping/Returns/Privacy/Terms and checkout links use data-demo and are intentionally disabled. No reference dashboard is exposed.
- Search for wool returned no matches despite the Wool Overcoat seed product being visible. Preserve the search design but back it with the VERA tenant catalogue.
- Cart recommendation/product URLs sometimes leave the example namespace. Use scoped VERA links in the implementation.
- The black sample-shop strip can intercept the mobile cart close control. Treat this strip as demo chrome and exclude it from storefront visual comparisons. Do not reproduce its pointer interception.
- Demo product titles and images are occasionally semantically inconsistent. The user specifically requested the same reference images, so use those assets unchanged.
- These are public storefront observations; the external site's private backend/project structure cannot be inferred as inspected source.

## Integration decisions

Use template ID/renderer gala with separate storefront and separate dashboard UI, first in the catalogue. Default preview brand MAISON VERE, base currency EUR. Existing merchant auth, order/payment/inventory APIs and tenant scoping remain the shared commerce foundation. GALA must use its own CSS scope and explicit lazy imports.

Home, navigation, product presentation, curated product relationships, FAQ, testimonials, service blocks, footer, currency display and cart configuration must be editable and persist through server validation/version conflicts. New filters require server support: alphabetical sorting, out-of-stock selection and aggregate approved ratings. Product option labels/SKU/merchandising metadata currently have no complete contract and need validated additive fields. Newsletter subscribers have a table but no existing submission/management API; wire it explicitly. Photo/title/privacy review extensions require additive tenant migrations, moderation and public/private response separation.

Functional account, saved-items, checkout/receipt, tracking/contact/policy routes should use the captured design language because their demo equivalents cannot be opened. Preserve verified purchase review rules, payment verification and tenant isolation. Display-currency conversion is presentation only; checkout remains in the configured base currency and uses server totals. Exchange rates need a real source or merchant-provided dated rates, never invented rates or currency relabeling.

All eight sample products, sample testimonials and collections belong to preview/review fixtures; genuine new stores start without fictional orders/reviews/inventory. Template settings preserve server-owned identity. New routes must be added to production SPA allowlists. Existing stores need additive schema migrations, not reseeding.

## Atelier images — user confirmed mapping

The user explicitly selected attachment order mapped to existing catalogue order, images only:
1. Sweater -> alpaca-scarf
2. Sunglasses -> alpaca-beanie
3. Plates/orange -> alpaca-gloves
4. Vase/flower -> alpaca-blanket

Original files: /tmp/codex-remote-attachments/01a11b12-0288-767c-9d04-9f36de3cd07c/7FB78840-39E0-4280-A85E-41EF00431AB6/{1,2,3,4}-صورة-{1,2,3,4}.jpg

Do not rename products or change text, prices, variants, layout or other features. Replace image/images fields. Existing customized images must be preserved; update only known original placeholder images through an idempotent migration. Refresh Atelier preview images without wiping merchant data. Record template preview seed version separately.

## Landing integration

Preserve the existing VERA palette (#743f37, #b49473, #f2f1ef, #4a3a33, #737365, #f0e4af), Playfair/Raleway typography and editorial row composition. Add GALA first with its own screenshot/palette/bilingual tagline and CTA. Make template cards consume manifest metadata instead of a FORM-vs-Atelier conditional; update two-template copy and selected preview visuals. Do not theme the landing as GALA.

## Acceptance evidence to produce during implementation

Reference vs local screenshots at identical 1440/390/320 viewports, with matching state and scroll, local fonts/images fully loaded, transitions settled and external sample strip excluded. Side-by-side/overlay/diff comparisons for home sections, collection, product, mega menus, search, cart and mobile navigation; document any justified differences instead of claiming mathematical pixel identity.

Functional tests: create gala store; independent dashboard; every customization saved/reloaded/reflected; published/draft isolation; variants, ratings/stock/name filters; saved/account/history; cart/add-all and no oversell; COD and Paymob mocked verification; recovery/reviews/returns; newsletter; version conflicts; tenant isolation; fresh database and upgrade from 2.1; regression checks for FORM/Atelier/platform. Update old browser assertions only where the final intentional UI contract changed.
