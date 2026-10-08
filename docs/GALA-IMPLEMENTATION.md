# GALA — implementation and review

GALA is the first template in VÉRA's gallery. Its storefront reproduces the public MAISON VERE example at https://www.banzena.com/examples/gala?page=home, using the downloaded source images and Albert Sans font. The public reference CSS is scoped to `.gala-store`; its scripts, tracking, and external service code are not embedded.

## Run the review

```sh
npm ci
npm run build
node scripts/review-gala.mjs
```

- Landing: http://127.0.0.1:3002/
- Reference catalogue: http://127.0.0.1:3002/demo/gala
- Editable fixture: http://127.0.0.1:3002/s/gala-review
- Dedicated studio: http://127.0.0.1:3002/s/gala-review/admin
- Fixture password: `local-review-only-123`

The script writes isolated data to `output/gala-review-data`. The fixture credentials and products are local test data. Normal provisioning creates an empty merchant catalogue and empty editorial testimonials; eight products, six collections, and three testimonials belong to the template preview. `/demo/gala` blocks server writes.

## Architecture

The platform provisions shops via `server/platform/core.js`. GALA uses the existing per-tenant database, catalogue, inventory, checkout, orders, shopper authentication, returns, payment providers, and analytics. The registry maps `gala` to the lazy renderer in `src/templates/gala/GalaApp.jsx`. The admin UI is lazy loaded separately, with a dedicated sidebar, design inspector, published-store preview, content editor, identity editor, messages and newsletter. Existing operational panels retain the tested order/payment APIs inside the new studio.

The schema in `src/data/gala.js` owns GALA's 10 colour roles, typography, layout, ordered sections, collage images and focal positions, navigation, featured IDs, lookbook, story image, testimonials, service promises, FAQs, product toggles, cart options, newsletter, footer columns and display currencies. `validateGala` rejects malformed nested settings. Saving uses the same optimistic version contract as other store settings.

`server/gala.js` adds scoped customer messages, newsletter signup/management, currency display rates, and review images. `retail_reviews.metadata` adds title, optional display name, name privacy and photo IDs. Photos require shopper authentication; pending/rejected photos are available only to their uploader or an authenticated merchant. Public reviews require a delivered purchase and merchant approval.

Products support SKU and up to three named option dimensions per variant. Options must be consistent and combinations unique. `merchandising.relatedIds`, `bundleIds` and `recommendedIds` control the product recommendations and bundles. Purchases validate live stock; server checkout remains authoritative for prices, stock, shipping, discounts and payment status.

## Merchant controls

- **GALA design studio:** 22 groups of settings, bilingual copy, array add/remove/reorder, exact palette colours, local image uploads, section visibility and order, desktop/mobile published preview.
- **Products and collections:** existing CRUD, inventory, sale prices, gallery, specifications, bilingual descriptions; GALA option values, SKU and merchandising selections.
- **Brand:** store name, tagline, SEO description, logo and announcement. GALA palette and typography are controlled in its design studio.
- **Content:** independent English/Arabic hero, story, shipping, returns, privacy and terms.
- **Contact and social:** footer text, location, email, phone, copyright and social links. Footer navigation columns and newsletter copy live in the design studio.
- **Operations:** orders, customers, verified reviews/photo moderation, returns, messages, subscribers, shipping/promotions, payments, analytics and integrations.

Editing the storefront preview in an iframe requires same-origin embedding. CSP `frame-ancestors 'self'` permits this while continuing to block third-party embedding.

## Reference findings and deliberate differences

- The reference names Gilda Display but its actual Google Fonts request does not load it; Georgia is the rendered heading face. The default uses Georgia to match the observed rendering. Albert Sans is hosted locally.
- The reference account, checkout and informational links are demo-only disabled controls. Those routes are functional in VÉRA; no inaccessible private Banzena dashboard was claimed or reproduced.
- Reference search returned no result for “Wool”; VÉRA uses the real catalogue search. The default sort label is “Featured,” accurately describing the reference catalogue order; all offered sort modes actually work.
- The VÉRA demo banner, VÉRA footer attribution, Arabic control, and conditional live currency availability are platform integration differences. No reference tracking scripts or third-party payment marks are embedded. Exact pixel identity of every state is not claimed.
- Display conversion uses fresh rates from `open.er-api.com`, cached for 24 hours. If unavailable, the base currency remains usable. Orders charge the merchant's configured base currency. Real online payments require configured provider credentials.
- Header/hero/collections/product grid/lookbook geometry was compared directly at 1440×1000. Desktop/mobile home, collection, product, search, menu, cart and dashboard screenshots are under `output/gala-verification` in the working review environment. Reference research captures all eight products and all six collections; the audit and asset provenance are in `docs/gala-reference`.

## Atelier change

Only the four requested product images change, in supplied order: scarf → sweater photo; beanie → sunglasses; gloves → plates; blanket → vase. `server/atelier-images.js` replaces exact original placeholder URLs and leaves custom images, product names, descriptions, prices, variants, and stock intact. The migration is idempotent. Template preview version 2 refreshes the sample image catalogue.

## Verification

- `npm run build`
- `npm run lint`
- `npm test`
- `npm run test:platform:e2e`
- `npm run test:e2e`

`tests/gala.test.js` covers preview/real-store separation, tenant isolation, nested validation, version conflicts, SKU/options/merchandising persistence, newsletter consent, message management, stock/price/rating filters, purchased reviews with photo privacy/moderation, and non-destructive Atelier image migration.

`tests/platform-browser/gala.spec.js` covers desktop/mobile catalogue, working search, variants, cart quantities, saved persistence, menus, filters, Arabic layout, contact/newsletter delivery to admin, design publish/reload/iframe preview, and real cash-on-delivery checkout. Existing baseline assertions for the VÉRA monogram and current 13-tab Atelier dashboard were updated from their stale `B`/9 expectations; the underlying Atelier UI is unchanged.
