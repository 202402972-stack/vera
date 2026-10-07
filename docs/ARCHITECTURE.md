# Platform boundaries

- `server/platform-entry.js`: production startup and per-store notification worker.
- `server/platform/app.js`: account/owner APIs, route mounts, access/trial/pause checks.
- `server/platform/auth.js`: Google code exchange and server-verified identity; no client-supplied roles.
- `server/platform/paymob.js`: Egyptian subscription checkout and canonical transaction reconciliation.
- `server/platform/billing.js`: optional Stripe adapter for an eligible registered company.
- `server/templates/registry.js`: versioned templates, public metadata and initial store seed.
- `src/templates/registry.jsx`: an explicit allowlist of lazily loaded template renderers.
- `server/index.js` and existing React store modules: the preserved merchant engine and storefront.

## Isolation within one database

A store ID is assigned by the server from `platform_stores`, and never from a request body. AsyncLocalStorage carries that immutable ID through its request. Store table/index identifiers are namespaced `t_{id}_...` within **the same SQLite file and process**. SQL tokenization skips quoted string literals/comments and rewrites a trusted identifier allowlist. Prepared statements and analytics caches are keyed by tenant; notification jobs are keyed by tenant; export read connections capture and apply the tenant namespace too.

This preserves the existing engine's transaction, inventory and idempotency logic without injecting tenant predicates into arbitrary SQL. It is schema namespace isolation, **not** PostgreSQL row-level security. New code must use the scoped `db`/`stmt` helpers for store data; only platform repositories may use `rawDb` directly. New store tables/indexes must be added to the trusted registry and seed schema. Every query path and independent connection needs isolation tests.

Customer session and merchant session cookies are separate. Merchant cookie names and paths are store specific. Client carts, checkout idempotency and receipts are scoped by store path. Product images are public assets; UUID filenames are not authorization for private documents. No private files should be placed in the uploads/static directory.

Owner routes verify a current customer session plus an allowlisted verified Google email on every request. Knowing `/owner` is not sufficient. Store owners can manage only their own numeric store IDs. Password changes revoke all merchant sessions for that store.

## Adding another template

1. Add a manifest to `server/templates/registry.js` with a stable unique `id`, integer `version`, bilingual metadata, screenshot URL, renderer key, initial `settings` and `products`. Preserve the settings/product contract and the Arabic translations. Do not put secrets in the seed.
2. For a different storefront layout, implement a React renderer and register a statically analyzable `lazy(() => import(...))` entry in `src/templates/registry.jsx`. Use `useStore`, `useCart`, the shared store API and React Router basename. Keep `/admin` and commerce routes interoperable, or reuse the current `App` with a new home component. A theme variant can use the existing `boutique` renderer with its own settings.
3. Add assets under public, with licenses. Use `storeUrl` for raw tenant links and `storeKey` for any tenant browser storage. Never use unscoped `/api` calls from a template.
4. The gallery and create-store form read the public registry automatically. The server creates an isolated read-only preview at `/demo/{id}`. A manifest version bump rebuilds only that template's preview seed. Existing merchants retain their customized content.
5. Test both languages, 320/390/1440px, cart/checkout/admin integration, and cross-tenant isolation before releasing. Ten templates are ten registry entries/renderers, not ten deployments. Only Atelier is bundled today.

Templates are not tenant database migrations. Add future schema changes as explicit versioned, transactional migrations across every namespace; retain a backup and test upgrade from the previous release. Do not silently rerun initial seeds over merchant content.

## Import the pre-existing boutique

After a backup and a first successful Google login, run the importer with `IMPORT_OWNER_EMAIL`, `IMPORT_STORE_SLUG`, and `IMPORT_STORE_PASSWORD` in the process environment:

```bash
node --env-file-if-exists=.env scripts/import-legacy-store.js
```

The utility clones the existing unprefixed store tables into a newly provisioned tenant on the **same volume**. Products, orders, order history, discounts, analytics, collections and encrypted Telegram settings are preserved. Sessions are not copied; a new merchant password is set. The original tables remain intact. Do not run against a different data volume and expect uploaded images or encryption keys to be present.
