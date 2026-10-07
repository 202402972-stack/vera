# Delivery validation — 2026-10-07

This report records checks performed on Merchant Studio 1.1.0 in the execution workspace. It replaces the uploaded project's older validation report. The original source was retained as the initial local Git commit. No live store or external account was deployed or changed.

## Verified

| Check | Observed result |
| --- | --- |
| Node runtime | Node.js 24.19.0 |
| Dependency installation | `npm ci` passed |
| Lint | `npm run lint` passed |
| Backend tests | 42 passed, zero failures |
| Full Chromium browser suite | 20 passed, zero failures |
| Follow-up browser checks after final refinements | 5 passed: both mobile dashboard languages and the three new studio/commerce/recovery journeys |
| Follow-up commerce tests after catalogue ordering refinement | 10 passed |
| Production build | `npm run build` passed; no oversized-chunk warning |
| Runtime dependency audit | `npm audit --omit=dev`: zero known vulnerabilities reported at time of execution |
| Backup/restore exercise | Fresh database backed up with the supplied script, reopened from the backup, integrity check passed, four seed products preserved, encryption key successfully decrypted a probe value |
| Production smoke | Production-mode backend served health and the built storefront, returned a real HTTP 404 for an unknown route, and issued Secure/HttpOnly session cookies with trusted HTTPS proxy context |
| Default-password protection | Production startup without a private password refused to start |
| Visual review | Desktop 1440px and mobile Arabic/English; overflow checks at 320, 390 and 768px; no browser runtime errors in final screenshot run |
| Patch whitespace | `git diff --check` passed |

Automated browser tests use a built application, isolated temporary database and mocked Telegram transport. The test suite does not send real messages. New journeys exercise the actual APIs and persistence rather than substituting mock storefront data.

## Connected journeys tested

- Publish a different brand name, palette and announcement from Brand studio; verify the live storefront and persistence after reload.
- Dismiss the unsaved-change prompt and retain the current draft.
- Configure shipping, a free-delivery threshold, tax and a delivery-country allowlist in the dashboard.
- Create a coupon from the dashboard, apply it at checkout and verify the correct total on the persisted receipt.
- Enter carrier/tracking details, mark the order shipped and verify the customer's private tracking page.
- Check search empty states and recovery, clearing filters, corrupted-cart recovery, working contact links, real 404 handling and retry after an unavailable store API.
- Exercise all nine dashboard sections on narrow screens in Arabic and English, with real order and analytics rows.
- Preserve the existing product editing, upload, localization, checkout, cancellation/restock, analytics, export and Telegram retry tests.

## Important server invariants

Tests cover server-owned price calculations; capped fixed discounts; tax rounding; free-delivery eligibility after discount; country restrictions; paused orders; minimum order and coupon spend; coupon expiry; private discount administration; optimistic configuration edits; atomic last-coupon redemption; stock rollback on failed orders; idempotency; safe shipment URLs; status history; stale order status rejection; logo aspect ratio; unsupported currency scales; product pagination/search/sort/category filtering; preservation of old order snapshots; and safe image/HTML/link handling.

## Performance observations

Synthetic local dataset: 2,504 products, 10,000 orders, 20,000 visits and 80,000 events. SQLite integrity check returned `ok`. Raw output is in `quality/benchmark.json`.

| Operation | p50 | p95 |
| --- | ---: | ---: |
| Catalogue first page | 30.6 ms | 79.6 ms |
| Dashboard product page | 24.9 ms | 33.4 ms |
| Indexed product detail | 11.0 ms | 14.0 ms |
| Dashboard order page | 19.0 ms | 25.6 ms |
| Order customer search | 102.2 ms | 146.0 ms |
| Analytics including cold query | 8.7 ms | 232.8 ms |
| Transactional checkout | 32.4 ms | 34.0 ms |

These are local HTTP measurements from a synthetic fixture, not an internet-load or hosting-capacity guarantee. Catalogue/product/order runs use concurrency 10; checkout uses concurrency 8. Search and analytics use concurrency 4.

English font web assets decreased from 2,752,824 to 756,048 bytes (approximately 72.5%) using WOFF2, with the original licensed typefaces retained. The primary JS bundle is approximately 490 kB uncompressed / 164 kB gzip; product, checkout, receipt, information and admin routes load separately. Arabic font assets remain locally hosted WOFF2.

## What was not certified

Docker image construction and a live Railway deployment were not executed in this workspace. Live DNS/HTTPS infrastructure, Telegram credentials, actual carrier delivery, commercial policies and jurisdiction-specific tax correctness require the owner's real configuration. No card-payment integration is present. There is no claim of universal accessibility compliance, unlimited capacity, penetration-test certification or complete support for every international market.

The supported deployment model is one independent brand per instance, one owner credential, one persistent SQLite volume, one application replica, one two-decimal currency, one exclusive tax rate, flat/free-threshold delivery and cash on delivery. See the README for the exact behavior and operational limits.
