# Release validation — 7 October 2026

The implementation was tested locally, not deployed to a live Railway account.

- **62 server tests pass**: the original 44 store tests plus platform/billing/collection/import checks. Coverage includes tenant namespaces and indexes, prepared statements, real export content, cross-account access denial, owner authorization, CSRF, Google PKCE/state/nonce with signed test ID tokens, trial expiry, pause/suspension, session revocation, collections, legacy import, and canonical Paymob transaction reconciliation including underpayments, replay, renewal, refund and persistent retry behavior.
- **26 original store browser tests pass**: Arabic/English, content/product editing, checkout and durable receipt, inventory, tracking, exports, brand customization, phone layouts, RTL menu anchoring, password eye and mobile dashboard header behavior.
- **11 platform browser tests pass**: both languages at 320/390/1440px, exact requested hero palette, mobile menu, create/pause/admin SSO flow, password reset, collections reaching the storefront, scoped Contact route, owner access control, and Arabic account/login layouts.
- Production Vite build passes, with landing and store bundles loaded separately.
- ESLint passes with no warnings.
- Docker multi-stage production image builds with Node.js 24. The managed test environment required its TLS proxy CA during npm dependency download; the optional build secret does not enter the image and is not required on ordinary Railway builds.

An initial simultaneous browser run collided in Playwright's shared trace output directory. The two suites now have separate output directories and were rerun successfully. An export-specific review found and fixed a separate read connection missing tenant scope; content isolation is covered by a server test.

## Boundaries of the evidence

Google's real consent screen and Paymob's live merchant account were not exercised. Provider tests use signed fixtures/mocked API responses, not real charges. Complete the live-provider scenarios in INTEGRATIONS.md with your account keys before accepting subscriptions. The Paymob callback schema must match your enabled account/API contract. Real mail delivery, custom domains per merchant, additional storefront designs and shopper card payment processing are not included in this release.

Single-replica SQLite is the deployed storage model; no claim of horizontal scalability, HA, load certification or zero-downtime migrations is made. The UI is responsive in the tested widths and honors reduced motion; there has not been a formal independent accessibility audit. The proposed VÉRA identity has not been trademark- or domain-cleared.

Production container smoke checks also passed: `/api/health`, public config, sorted template catalogue and landing return 200; anonymous customer/owner endpoints return 401; template admin returns 403. A value written to the mounted `/data` volume survived a container restart. `npm audit --omit=dev` reported **zero known production dependency vulnerabilities** at the time of this check; that is a point-in-time dependency scan, not a security certification.
