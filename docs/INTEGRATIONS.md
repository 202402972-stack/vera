# Google and billing setup

## Google-only customer sign-in

Create a Google OAuth **Web application** client. Configure the consent screen, support email and production audience. Add the exact redirect URI:

`https://your-domain/api/platform/auth/callback`

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `PUBLIC_URL` on Railway. Development uses the same path under the local PUBLIC_URL, e.g. `http://localhost:3000/api/platform/auth/callback` through Vite's proxy. The backend exchanges the authorization code using PKCE, checks one-time state and nonce, and validates the ID token signature, issuer, audience, expiry and verified email. Google account subject is the identity key. No Google access/refresh tokens are retained.

Put verified owner emails in the server-only comma-separated `OWNER_EMAILS` variable. Ordinary customers cannot acquire the owner role through request parameters or profile edits. Store dashboard passwords are independent and hashed; there is no plaintext-password retrieval endpoint.

Before public launch, test a successful login and logout, denied/canceled consent, expired callback, a non-owner account, and a return to `?intent=create` on the real deployed domain.

Google references: https://developers.google.com/identity/openid-connect/openid-connect and https://developers.google.com/identity/openid-connect/reference.

## Egypt / Paymob

Paymob is the default adapter. Your account must be approved for recurring subscriptions and have separate initial 3DS and recurring MOTO integrations. The app cannot enable merchant capabilities on your behalf.

1. Obtain API key, secret key, public key, and HMAC secret. Set the matching test-mode credentials first; do not mix live/test IDs.
2. Create a subscription plan in Paymob with frequency **30 days**, the approved charge amount/currency, your MOTO integration, and `use_transaction_amount: true`. The initial payment must count as a subscription payment; do not use a card-validation-only initial charge with this adapter.
3. Set `PAYMOB_PLAN_ID`, `PAYMOB_INTEGRATION_ID` (initial 3DS), `PAYMOB_MOTO_ID`, `PAYMOB_AMOUNT_CENTS`, and `PAYMOB_CURRENCY`. The displayed starting price is USD 1.50. Use USD 150 cents only if your Paymob integrations support USD; otherwise configure the chosen EGP plan amount explicitly. No guessed exchange rate is applied.
4. Configure the transaction processed callback on **both** integrations as `https://your-domain/api/platform/paymob/webhook`. This implementation accepts signed `TRANSACTION` callbacks, not unsigned subscription lifecycle notifications. The initial intention also specifies this callback and the workspace return URL.
5. Checkout captures required billing names/phone and explicit renewal consent. Card details are entered only in Paymob's hosted checkout. No card numbers or saved card tokens are stored by VÉRA.
6. Callback HMAC is checked first; the server then fetches the canonical transaction and its subscription from Paymob, matches the stored checkout order or subscription, plan, integration, amount and currency, then updates access. Browser return parameters never activate a store. Duplicate callbacks cannot extend access.
7. Cancel renewal from the workspace. Cancellation retains the paid period. Pausing a storefront is separate from subscription cancellation.

### Mandatory live-provider acceptance checks

The local suite tests the adapter with mocked provider responses; it does not certify a merchant account. Confirm the exact subscription response shape in your account's API version (`plan` / `plan_id`, `id`, `state`) and test:

- Initial 3DS success/failure/cancellation; callback arriving before the browser return.
- MOTO renewal success/failure, delayed/duplicate callback, and missed-callback replay.
- HMAC failure, amount/currency mismatch, cancel renewal, full refund and void.
- An expired trial becoming active only after provider confirmation.

Keep a support contact available for disputed payments and manual reconciliation. A payment provider timeout can leave a checkout marked as preparing until its one-hour expiry; do not create parallel checkouts to work around an uncertain payment. Payment history records provider transaction IDs; it is not represented as an Egyptian tax invoice. Tax invoice requirements depend on the registered business.

Paymob references:
- https://developers.paymob.com/paymob-docs/developers/subscription/create-subscription-plan
- https://developers.paymob.com/paymob-docs/developers/subscription/subscription-actions/list-subscription-details
- https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/by-transaction-id
- https://github.com/PaymobAccept/API-Postman-Collections
- https://www.paymob.com/en/subscriptions

## Optional Stripe adapter

`BILLING_PROVIDER=stripe` selects the included Checkout/customer-portal adapter. This is not the recommended default for an Egyptian entity; use it only with an eligible registered Stripe account. Configure `STRIPE_SECRET_KEY`, a recurring `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET`; enable the customer portal and register `/api/platform/billing/webhook` for subscription created/updated/deleted events. Signatures use the raw body. The configured price is read from Stripe, not submitted by the browser.

References: https://docs.stripe.com/payments/checkout/limit-subscriptions and https://docs.stripe.com/api/customer_portal/sessions/create.

## Storefront payments and Telegram

Shopper checkout remains cash on delivery. Platform subscription billing does not add card checkout to the boutique. Each merchant configures its own Telegram integration from its store dashboard. Credentials are encrypted with the volume key and exports exclude them. Do not enable live notifications during synthetic order tests.

Failed signed confirmations are persisted in a retry queue with exponential backoff (up to eight attempts). The owner can retry a provider transaction ID from `/owner`; this operation retrieves and validates the payment again and cannot manually mark an unpaid store as paid. Price/plan changes for existing subscribers require a deliberate provider migration; do not replace the active global Paymob plan variables while old subscriptions still renew against a different amount.
