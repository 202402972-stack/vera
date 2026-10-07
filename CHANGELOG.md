# VÉRA 2.0.0 — 2026-10-07

- Add the VÉRA marketing, Google login, customer workspace, owner console and template registry above the original boutique.
- Match the requested Pixells palette and hero composition in Arabic and English, with local fonts and vector brand assets.
- Isolate tenant products, orders, settings, sessions, analytics, notification jobs and streamed exports within one SQLite database.
- Add 14-day account trials, per-store access control and Egypt-oriented Paymob subscription integration, with signed callbacks and canonical transaction checks.
- Add merchant collections in the dashboard and storefront, scoped Contact navigation, dashboard-password changes and owner resets.
- Preserve the 1.2 merchant UI, RTL menu, mobile header, light-gold CTA, brand and commerce improvements.
- Provide one-service Railway deployment, backup/import tooling, provider setup instructions and release checks.

---

# 1.2.0 — Considered refinements

- Anchored the store menu to its trigger in LTR and RTL, including language switches while browsing. Corrected Home navigation from secondary store pages.
- Restored the atelier's light gold collection/cart buttons through an independently editable, server-validated button color with automatic readable text. Existing custom palettes retain their own color.
- Redesigned the dashboard entrance using the actual store photograph, a forest/ivory editorial layout, direct language switching, an RTL-safe password toggle and a Caps Lock hint.
- Kept a consistent Latin B monogram across dashboard languages.
- Added a compact-screen header that hides on downward scroll and returns on upward scroll, without layout jumps; keyboard focus and reduced-motion preferences are respected.
- Product details choose an available style, disable quantity controls at stock/cart limits, label sold-out styles and cancel stale product requests. Removed the redundant inventory round-trip.
- Recent orders and order-table actions open a reloadable private detail URL. Added authenticated detail retrieval and a persistent status-history timeline in the dashboard.
- Added regression coverage for direction switching, password controls, scrolling, quantity boundaries, order deep links and configurable button colors.

# 1.1.0 — Merchant Studio

- Rebuilt the dashboard shell with an isolated forest/ivory palette, semantic order states, mobile navigation, direct language switching and an actionable operations overview.
- Added Brand studio with safe logo upload, four palettes, custom validated tokens, typography/corners, bilingual announcements, story visibility and a live draft preview.
- Added server-authoritative checkout quotes, shipping thresholds, country allowlists, minimum orders, a pause control, tax and atomic limited-use discounts.
- Connected discount/tax totals to checkout, order snapshots, customer receipts, dashboard details, Telegram photo receipts and CSV/JSON exports.
- Added carrier/tracking details, private customer progress and persistent status history.
- Added server-side catalogue search/category/sort and category editing; corrected sold-out card behavior.
- Added editable shipping/returns policies, storefront loading/retry states, an error boundary, proper 404 responses and keyboard-accessible cart behavior.
- Fixed broken email/phone links throughout the store and dashboard, development proxy origin checks, malformed stored-cart recovery and checkout persistence when sessionStorage is unavailable.
- Hardened production password requirements, currency-scale validation, settings contrast validation and stale order status updates.
- Optimized font delivery with local WOFF2 and split more routes from the initial bundle.
- Added integration/browser regression coverage, fresh deployment/backup documentation, token documentation and visual previews.

The original seed catalogue remains intact. Existing database changes are additive; order snapshots retain historical prices and identity.
