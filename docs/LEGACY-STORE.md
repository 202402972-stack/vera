# Boutique — Merchant Studio

An independently deployable luxury storefront and merchant dashboard. React 18 / Vite, Express 5 and SQLite on Node.js 24. Arabic and English, with local fonts and RTL layouts. Each brand runs its own application instance, domain, credentials and persistent data volume.

## Version 1.2 refinements

The store menu follows its trigger in both directions. Atelier shopping buttons regain their light gold with a separate Brand studio color control. The dashboard has a new bilingual sign-in page, a fixed Latin B monogram and a mobile header that hides downwards and returns upwards. Product quantities account for stock and the existing bag. Orders open directly from the overview or list using an authenticated, reloadable URL, with their status history visible in the detail dialog.

## Run locally

```bash
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`; management is at `/admin`. The local development password is `admin@admin` unless `ADMIN_PASSWORD` is set. `.env` is loaded by the start/dev scripts. Never use the development password for a public store.

```bash
npm run build
npm start
```

Node.js 24 is required because the backend uses built-in SQLite. Use the checked-in lockfile with `npm ci`.

## What the dashboard controls

- **Overview:** actual recent orders, orders awaiting preparation, low-stock styles, failed notifications, catalogue counts and first-party analytics. Empty states are genuine; no invented sales or revenue.
- **Products:** drafts/publication, names and descriptions in both languages, variants, inventory, sale prices, category, image galleries and catalogue ordering. Low-stock alerts open the relevant editor. Product category labels are shared between languages.
- **Brand studio:** translated store name, uploaded logo, four curated palettes, custom colors, serif/sans headings, soft/sharp corners, bilingual announcement and homepage story visibility. Live preview uses real store content. Publishing updates storefront tokens; dashboard colors remain independent. Server validation enforces at least 4.5:1 text/accent contrast on both configured surfaces.
- **Commerce:** delivery fee, optional free-shipping threshold, order minimum, permitted delivery countries, a single exclusive tax rate, order pause and low-stock threshold. Discount codes support percentage/fixed discounts, minimum spend, expiry, limited redemptions and activation/deactivation.
- **Content:** bilingual metadata, hero image/copy, brand story, collection copy, contact details, footer links/socials and privacy/terms/shipping/returns policies.
- **Orders:** search, status, cancellation/restocking, snapshot details, carrier, tracking number and HTTPS tracking URL. Customers see progress and shipment tracking on their private receipt page. The receipt refreshes every 30 seconds while open.
- **Connections:** Telegram order notifications, retry visibility and protected exports.

Language can be switched inside the dashboard. Changing the language does not discard a content draft. Brand/commerce/content editors warn about leaving unpublished changes. Optimistic version checks prevent old settings or product editors from overwriting newer changes or sold inventory.

## Customer experience

Search English or Arabic product names, filter categories, sort server-side and paginate through the catalogue. Cards select an available variant and disable purchasing when none are available. The bag supports keyboard focus trapping, Escape-to-close and a free-delivery progress indicator. Checkout refreshes product availability and obtains a server quote, supports a coupon and shows item subtotal, discount, tax, delivery and total separately. Failed quotes block submission. Contact links are real `mailto:` / `tel:` links. Unknown pages have a 404 response and recovery UI.

Customer payment is **cash on delivery only**. No card data is collected and no inactive card option is presented. Card payments, refunds through a payment provider, email delivery and carrier API integration are not implemented. Tracking links are entered by the merchant.

## Pricing contract

All monetary values are integer hundredths of the store currency. Configure a currency that uses **two fractional digits** (e.g. USD, EUR, GBP, EGP, SAR, AED). Zero- or three-decimal currency support and live FX conversion are not included. Changing currency re-labels current product amounts; it does not convert them. Existing order snapshots retain their original currency. Discount codes tied to an earlier currency cannot be redeemed after a currency change.

1. Sum current server prices, including product sale prices.
2. Validate order minimum and delivery destination.
3. Validate one discount code, including minimum spend, expiry and usage limit.
4. Subtract the discount, capped at the merchandise subtotal.
5. Apply the free-delivery threshold to **discounted merchandise**.
6. Calculate exclusive tax on discounted merchandise, rounded to the nearest minor unit. Delivery is excluded.
7. Add delivery and tax.

This is a single-rate model, not an international tax engine. Configure the correct rate and policies for the market you operate in. Allowed countries are merchant-provided names, rendered as a checkout select; an empty list accepts any country.

Order creation, inventory deduction and coupon redemption happen in one SQLite transaction. Idempotent retries return the original order without consuming more stock or coupon uses. Invalid quotes, exhausted codes or unavailable stock roll back the complete order. Cancellation restores tracked inventory once; **coupon redemption remains consumed** to prevent cancel-and-reuse abuse. Delivered and cancelled orders cannot be reopened.

## Production deployment (Railway or a Node/container host)

1. Deploy this directory with `Dockerfile` and `railway.json` at repository root.
2. Mount one durable volume at `/data`. Configure **one running replica**.
3. Set `ADMIN_PASSWORD` to a private value of at least 12 characters. Production startup refuses a missing/short password or `admin@admin`.
4. Keep `NODE_ENV=production`, `DATA_DIR=/data`. Railway supplies `PORT`; the Docker default is 3000.
5. Connect your own domain and HTTPS through the hosting platform.
6. Configure the brand, products/photos, contact information, currency, shipping, tax and policies from `/admin`.
7. If using Telegram, configure your bot and chat ID in Connections and send a real test.
8. Place a real operational test order, check preparation and delivery procedures, and verify backup restoration before accepting customers.

A separate brand requires a separate deployment with its own volume and credentials. This deliberately does not implement a shared multi-tenant SaaS or team roles. One administrative credential controls a deployment.

The app trusts one upstream proxy hop. Deploy behind the expected platform proxy and do not expose a parallel untrusted path to the application port. Sessions are hashed in SQLite with HttpOnly/SameSite=Strict cookies, and Secure cookies on HTTPS. Changing `ADMIN_PASSWORD` invalidates existing sessions. Login, checkout and uploads are rate limited. State-changing API requests enforce same-origin checks. Uploads are decoded and re-encoded as WebP; SVG uploads are rejected. Rich product descriptions are sanitized. Telegram credentials are encrypted using a per-volume key.

Use a persistent disk. Container filesystem storage alone loses orders and uploads when the container is replaced. SQLite WAL transactions are appropriate for a single service, not multiple writable application replicas sharing a volume.

## Backup and restore

Run inside the service with the volume mounted:

```bash
node scripts/backup.js /backup/boutique-2026-10-07
```

Keep the complete output privately: `store.sqlite`, `uploads/`, and `.encryption-key`. Exported JSON/CSV is useful for reporting but is **not** a full restorable backup. JSON includes catalogue, store settings, orders, discounts, status history and analytics; secrets and upload bytes are excluded. CSV includes discount/tax and shipment details, with spreadsheet-formula protection.

To restore:

1. Stop the application and keep an additional copy of its existing data directory.
2. Restore all three backup components into a fresh data directory. Do not retain WAL/SHM files from a different database.
3. Configure `DATA_DIR` to that directory and the correct admin password; start one replica.
4. Verify health, login, a sample order, image files and Telegram configuration. Resume traffic only after verification.

Migrations add tables/columns and preserve customized catalogue/content and order snapshots. Existing stores receive default branding/commerce behavior without reseeding their products. New optional policy pages fall back to existing delivery/terms copy until edited.

## Verification

```bash
npm run lint
npm test
npx playwright install chromium
npm run build
npm run test:e2e
npm run benchmark
```

Backend and browser tests use isolated temporary databases. Telegram networking is mocked in tests; no customer messages are sent. `npm run benchmark` seeds a separate synthetic dataset and reports measurements, not a traffic-capacity guarantee. See `VALIDATION.md` for results from this delivery and `DESIGN-SYSTEM.md` for tokens.

## Operational limits

- One deployment per brand; one owner credential, no staff roles or customer accounts.
- COD orders only; no payment processor, automatic refunds or carrier booking.
- One currency with two fractional digits and one tax rate per store.
- Country allowlist, flat delivery and optional free-delivery threshold; no postcode/carrier rate engine.
- Analytics identify browsers, not verified people; DNT/GPC are respected. Country attribution depends on a trusted hosting header and may be unknown. Analytics are not a consent-management platform.
- The included product data and contact details are demonstration content. Replace them with the real brand's catalogue, photography and policies before launch.
- No deployment, real payment, carrier delivery or real Telegram test is claimed by the automated test results.
