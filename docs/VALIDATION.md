# FORM 2.1 validation — 8 October 2026

This release was reviewed locally. `npm run lint` and `npm run build` passed. The focused command `node --test tests/form.test.js tests/retail.test.js tests/platform.test.js` passed **22 tests** covering tenant boundaries, template identity during saves, version conflicts, variant validation, shopper sessions and recovery, receipt capabilities, verified reviews/returns, checkout reservations, duplicate requests/callbacks and canonical payment mismatches.

Real browser review covered FORM at 1440px and 390px in English and Arabic, product detail, saved items, registration, COD checkout, durable receipt, account order history, merchant login, campaign image upload and settings persistence. The final screenshots are in the local `output/playwright` folder; selected release screenshots are included in `previews/form-2.1`. Mobile home had matching viewport/document width and no broken images. These checks exposed and fixed an empty-cart product request, lost template metadata after settings save and a tenant-rewritten SQL aggregate alias that broke order counts.

The remaining live acceptance step is merchant-specific Google/Paymob configuration and provider sandbox payment confirmation. Local provider tests mock network responses and do not prove a real charge. Production dependency audit reported **0 vulnerabilities**; development tooling retains 7 inherited findings (5 high, 2 moderate). A compatible `shell-quote` override removed the inherited critical finding. Tailwind's remaining dependency findings were not addressed with a forced major upgrade.

The historical validation below was included in the original 2.0 project. Those broad browser suites were not rerun for this release.

---

# Original release validation — 7 October 2026

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
