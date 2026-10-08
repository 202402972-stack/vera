# FORM implementation

Approved direction: separate modern storefront, existing green merchant studio, shared commerce engine. Templates are selected at store creation; existing stores are not switched.

## Delivery contract
- Register FORM independently of Atelier; preserve original store routes and presentation.
- Build responsive bilingual home, catalog, detail, cart, checkout and customer-service screens.
- Persist template-specific content and media configuration through the shared dashboard.
- Add shopper accounts, saved items, order tracking, moderated verified-purchase reviews and return/exchange requests.
- Keep shopper Paymob configuration and transactions separate from platform subscriptions. Never claim payment on a browser redirect.
- Present both templates on the existing landing page and gallery.
- Use demonstration inventory only in explicitly labeled previews; new merchant stores start with no invented inventory.

## Validation
Prioritize desktop/mobile screenshots in both languages. Run focused contract, authorization, inventory and checkout checks, lint and production build. Real Paymob acceptance requires merchant credentials and provider sandbox confirmation.

## Working defaults
Physical goods; one configured currency per store. Guest checkout remains available. Customer accounts are tenant scoped. Reviews require a delivered purchase and moderation. Return/exchange requests are merchant-reviewed; approval does not claim a completed refund. Existing store settings and data survive upgrades.

## Implemented design

FORM has its own renderer and scoped CSS. Cool white `#f7f9fa`, graphite `#172321`, pale blue imagery and forest `#2a5547` create a separate identity. Space Grotesk headings, Manrope body text and IBM Plex Sans Arabic are hosted locally with OFL licenses. The desktop uses a broad photographic hero, four category tiles, a restrained four-column product grid and a split campaign. Mobile uses independent image framing and two-column merchandise grids. RTL keeps hero copy in the image's open space while mirroring navigation and catalog composition.

Hero uploads use 1800 × 1200 (3:2); Atelier's existing hero upload remains independent. The saved contract controls desktop vertical framing and mobile horizontal framing, campaign imagery and section visibility. These axes correspond to the crop used by the wide desktop and portrait mobile hero. Merchant previews use the same image framing rule as the storefront. Product content, policies and campaign text remain independently editable in Arabic and English.

## Key code paths

- Manifests: `server/templates/registry.js`; renderers: `src/templates/registry.jsx`.
- FORM storefront: `src/templates/form/`; shared settings and cart providers: `src/hooks/`.
- Shopper accounts, saved products, tracking, review moderation and return requests: `server/retail.js`.
- Merchant online checkout and payment reconciliation: `server/shopper-payments.js`; shared order reservation: `server/index.js`.
- Dashboard controls: `FormDesign`, `RetailPanel`, `PaymentsPanel`, product/collection/order editors.

Read `FORM-QUICKSTART-AR.md` for Windows startup and `INTEGRATIONS.md` for separate shopper Paymob setup.
