import { createHmac, timingSafeEqual } from "node:crypto";
import { rawDb, encrypt, decrypt } from "../db.js";
import { sql, token, audit } from "./core.js";
import { requireUser, requireOwner } from "./auth.js";
export const paymobSelected =
  (process.env.BILLING_PROVIDER || "paymob") === "paymob";
export const paymobReady =
  paymobSelected &&
  [
    "PAYMOB_SECRET_KEY",
    "PAYMOB_PUBLIC_KEY",
    "PAYMOB_API_KEY",
    "PAYMOB_HMAC_SECRET",
    "PAYMOB_INTEGRATION_ID",
    "PAYMOB_MOTO_ID",
    "PAYMOB_PLAN_ID",
    "PAYMOB_AMOUNT_CENTS",
    "PAYMOB_CURRENCY",
  ].every((k) => !!process.env[k]) &&
  Number.isSafeInteger(Number(process.env.PAYMOB_AMOUNT_CENTS)) &&
  Number(process.env.PAYMOB_AMOUNT_CENTS) > 0 &&
  /^[A-Z]{3}$/.test(process.env.PAYMOB_CURRENCY) &&
  ["PAYMOB_INTEGRATION_ID", "PAYMOB_MOTO_ID", "PAYMOB_PLAN_ID"].every((k) =>
    /^\d+$/.test(process.env[k]),
  );
export const paymobPlan = () =>
  paymobReady
    ? {
        amount: Number(process.env.PAYMOB_AMOUNT_CENTS),
        currency: process.env.PAYMOB_CURRENCY,
        interval: "30 days",
      }
    : null;
rawDb.exec(`CREATE TABLE IF NOT EXISTS platform_payment_queue(id TEXT PRIMARY KEY,attempts INTEGER NOT NULL DEFAULT 0,next INTEGER NOT NULL DEFAULT 0,error TEXT);
CREATE TABLE IF NOT EXISTS platform_paymob_checkouts(reference TEXT PRIMARY KEY,store_id INTEGER NOT NULL,order_id TEXT UNIQUE,url TEXT,expires INTEGER NOT NULL,created INTEGER NOT NULL,state TEXT NOT NULL DEFAULT 'creating');
CREATE TABLE IF NOT EXISTS platform_paymob_payments(id TEXT PRIMARY KEY,store_id INTEGER NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL,created INTEGER NOT NULL,until INTEGER NOT NULL,status TEXT NOT NULL,subscription TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS platform_paymob_store ON platform_paymob_payments(store_id);`);
const base = "https://accept.paymob.com";
async function api(path, { method = "GET", body, auth } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: auth } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("Payment provider request failed.");
  return r.json();
}
let cachedToken = null;
async function bearer() {
  if (cachedToken && cachedToken.until > Date.now())
    return "Bearer " + cachedToken.token;
  const r = await api("/api/auth/tokens", {
    method: "POST",
    body: { api_key: process.env.PAYMOB_API_KEY },
  });
  cachedToken = { token: r.token, until: Date.now() + 300000 };
  return "Bearer " + r.token;
}
const hmacFields = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order.id",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
];
export function verifyPaymobHmac(obj, signature, secret) {
  if (
    !obj ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{128}$/i.test(signature) ||
    !secret
  )
    return false;
  const message = hmacFields
    .map((key) => {
      if (key === "order.id")
        return String(typeof obj.order === "object" ? obj.order.id : obj.order);
      const value = key.split(".").reduce((v, k) => v?.[k], obj);
      return value === undefined || value === null ? "" : String(value);
    })
    .join("");
  const digest = createHmac("sha512", secret).update(message).digest();
  return timingSafeEqual(digest, Buffer.from(signature, "hex"));
}
function list(value) {
  return Array.isArray(value)
    ? value
    : Array.isArray(value?.results)
      ? value.results
      : [];
}
const transactionJobs = new Map();
export async function reconcileTransaction(transactionId) {
  const id = String(transactionId);
  if (!/^\d{1,20}$/.test(id)) throw new Error("Invalid transaction identity");
  const previous = transactionJobs.get(id) || Promise.resolve();
  const job = previous.catch(() => {}).then(() => reconcileCanonical(id));
  transactionJobs.set(id, job);
  try {
    return await job;
  } finally {
    if (transactionJobs.get(id) === job) transactionJobs.delete(id);
  }
}
async function reconcileCanonical(transactionId) {
  const auth = await bearer();
  const txn = await api(
    "/api/acceptance/transactions/" + encodeURIComponent(transactionId),
    { auth },
  );
  if (String(txn.id) !== String(transactionId))
    throw new Error("Transaction mismatch");
  const order = String(
    typeof txn.order === "object" ? txn.order.id : txn.order,
  );
  const checkout = sql(
    "SELECT * FROM platform_paymob_checkouts WHERE order_id=?",
  ).get(order);
  const subscriptions = list(
    await api(
      "/api/acceptance/subscriptions?transaction=" +
        encodeURIComponent(transactionId),
      { auth },
    ),
  );
  if (subscriptions.length !== 1)
    throw new Error("Subscription confirmation pending");
  const sub = subscriptions[0];
  const subId = String(sub.id);
  if (!/^\d+$/.test(subId)) throw new Error("Invalid subscription identity");
  const historical = sql(
    "SELECT store_id FROM platform_paymob_payments WHERE subscription=? LIMIT 1",
  ).get(subId);
  const store = checkout
    ? sql("SELECT * FROM platform_stores WHERE id=?").get(checkout.store_id)
    : sql("SELECT * FROM platform_stores WHERE subscription=?").get(
        "paymob:" + subId,
      ) ||
      (historical
        ? sql("SELECT * FROM platform_stores WHERE id=?").get(
            historical.store_id,
          )
        : null);
  if (!store) throw new Error("Unrecognized subscription");
  const replacement =
    !!checkout && ["canceled", "cancelled"].includes(store.billing_status);
  const current =
    !store.subscription ||
    store.subscription === "paymob:" + subId ||
    replacement;
  if (!current && !historical) throw new Error("Subscription mismatch");
  const planId = String(
    typeof sub.plan === "object"
      ? sub.plan.id
      : (sub.plan ?? sub.plan_id ?? sub.subscription_plan_id),
  );
  if (planId !== process.env.PAYMOB_PLAN_ID)
    throw new Error("Subscription plan mismatch");
  const validIntegrations = [
    Number(process.env.PAYMOB_INTEGRATION_ID),
    Number(process.env.PAYMOB_MOTO_ID),
  ];
  if (
    !validIntegrations.includes(txn.integration_id) ||
    txn.amount_cents !== Number(process.env.PAYMOB_AMOUNT_CENTS) ||
    txn.currency !== process.env.PAYMOB_CURRENCY
  )
    throw new Error("Payment amount, currency or integration mismatch");
  const paid =
    txn.success === true &&
    txn.pending === false &&
    !txn.is_refunded &&
    !txn.is_voided &&
    !txn.is_refund &&
    !txn.is_void &&
    !txn.is_auth;
  const at = Date.parse(txn.created_at);
  if (!Number.isFinite(at)) throw new Error("Invalid payment timestamp");
  const status = paid
    ? "paid"
    : txn.is_refunded || txn.is_voided
      ? "refunded"
      : txn.pending
        ? "pending"
        : "failed";
  rawDb.exec("BEGIN IMMEDIATE");
  try {
    sql(
      "INSERT INTO platform_paymob_payments(id,store_id,amount,currency,created,until,status,subscription) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,until=excluded.until",
    ).run(
      String(txn.id),
      store.id,
      txn.amount_cents,
      txn.currency,
      at,
      paid ? at + 30 * 86400000 : 0,
      status,
      subId,
    );
    const until = sql(
      "SELECT coalesce(max(until),0) n FROM platform_paymob_payments WHERE store_id=? AND status='paid'",
    ).get(store.id).n;
    sql(
      "UPDATE platform_stores SET subscription=?,billing_status=?,access_until=? WHERE id=?",
    ).run(
      current ? "paymob:" + subId : store.subscription,
      current
        ? !replacement &&
          ["canceled", "cancelled"].includes(store.billing_status)
          ? store.billing_status
          : String(sub.state || status)
        : store.billing_status,
      until,
      store.id,
    );
    if (checkout)
      sql("UPDATE platform_paymob_checkouts SET state=? WHERE reference=?").run(
        paid ? "complete" : status,
        checkout.reference,
      );
    audit(null, "paymob." + status, store.id);
    sql("DELETE FROM platform_payment_queue WHERE id=?").run(String(txn.id));
    rawDb.exec("COMMIT");
  } catch (e) {
    rawDb.exec("ROLLBACK");
    throw e;
  }
}
export function registerPaymobWebhook(app) {
  app.post("/api/platform/paymob/webhook", async (req, res) => {
    if (!paymobReady) return res.sendStatus(503);
    const obj = req.body?.obj;
    if (
      req.body?.type !== "TRANSACTION" ||
      !verifyPaymobHmac(obj, req.query.hmac, process.env.PAYMOB_HMAC_SECRET)
    )
      return res.sendStatus(400);
    sql(
      "INSERT OR IGNORE INTO platform_payment_queue(id,next) VALUES(?,?)",
    ).run(String(obj.id), Date.now());
    try {
      await reconcileTransaction(obj.id);
      res.json({ received: true });
    } catch (e) {
      console.error("Paymob confirmation failed:", e.message);
      res.sendStatus(503);
    }
  });
}
export function registerPaymob(app, owned, rate) {
  if (!paymobSelected) return;
  app.post(
    "/api/platform/owner/payments/reconcile",
    requireOwner,
    rate,
    async (req, res, next) => {
      try {
        if (!paymobReady)
          return res
            .status(503)
            .json({ error: "Payments are not configured yet." });
        await reconcileTransaction(req.body.transactionId);
        audit(
          req.user.id,
          "owner.payment_reconciled",
          null,
          String(req.body.transactionId),
        );
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/platform/stores/:id/checkout",
    requireUser,
    rate,
    owned,
    async (req, res, next) => {
      try {
        if (!paymobReady)
          return res
            .status(503)
            .json({ error: "Payments are not configured yet." });
        if (
          req.store.subscription &&
          !["canceled", "cancelled"].includes(req.store.billing_status)
        )
          return res.status(409).json({
            error:
              "This store already has a subscription. Cancel renewal before starting another.",
          });
        const { firstName, lastName, phone } = req.body;
        if (
          [firstName, lastName].some(
            (x) => typeof x !== "string" || !x.trim() || x.length > 50,
          ) ||
          typeof phone !== "string" ||
          !/^\+[0-9]{8,15}$/.test(phone)
        )
          return res.status(400).json({
            error:
              "Enter your first name, last name, and international phone number.",
          });
        const existing = sql(
          "SELECT * FROM platform_paymob_checkouts WHERE store_id=? AND expires>? ORDER BY created DESC LIMIT 1",
        ).get(req.store.id, Date.now());
        if (existing) {
          if (existing.url) return res.json({ url: decrypt(existing.url) });
          return res.status(409).json({
            error:
              "Your payment session is being prepared. Please try again shortly.",
          });
        }
        const reference = "vera-" + req.store.id + "-" + token();
        sql(
          "INSERT INTO platform_paymob_checkouts(reference,store_id,expires,created) VALUES(?,?,?,?)",
        ).run(reference, req.store.id, Date.now() + 3600000, Date.now());
        const plan = paymobPlan();
        const result = await api("/v1/intention/", {
          method: "POST",
          auth: "Token " + process.env.PAYMOB_SECRET_KEY,
          body: {
            amount: plan.amount,
            currency: plan.currency,
            payment_methods: [Number(process.env.PAYMOB_INTEGRATION_ID)],
            subscription_plan_id: Number(process.env.PAYMOB_PLAN_ID),
            items: [
              {
                name: "VERA First Edition",
                amount: plan.amount,
                quantity: 1,
                description: "One store subscription, renewal every 30 days",
              },
            ],
            billing_data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              phone_number: phone,
              email: req.user.email,
            },
            special_reference: reference,
            expiration: 3600,
            notification_url:
              process.env.PUBLIC_URL + "/api/platform/paymob/webhook",
            redirection_url:
              process.env.PUBLIC_URL + "/workspace?billing=processing",
          },
        });
        if (!result.client_secret || !result.intention_order_id)
          throw new Error("Incomplete checkout response");
        const url =
          base +
          "/unifiedcheckout/?" +
          new URLSearchParams({
            publicKey: process.env.PAYMOB_PUBLIC_KEY,
            clientSecret: result.client_secret,
          });
        sql(
          "UPDATE platform_paymob_checkouts SET order_id=?,url=?,state='open' WHERE reference=?",
        ).run(String(result.intention_order_id), encrypt(url), reference);
        res.json({ url });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/platform/stores/:id/cancel-subscription",
    requireUser,
    rate,
    owned,
    async (req, res, next) => {
      try {
        if (!paymobReady || !req.store.subscription?.startsWith("paymob:"))
          return res
            .status(400)
            .json({ error: "No active Paymob subscription." });
        const id = req.store.subscription.slice(7);
        await api(
          `/api/acceptance/subscriptions/${encodeURIComponent(id)}/cancel`,
          { method: "POST", auth: await bearer() },
        );
        sql(
          "UPDATE platform_stores SET billing_status='canceled' WHERE id=?",
        ).run(req.store.id);
        audit(req.user.id, "paymob.canceled", req.store.id);
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get("/api/platform/invoices", requireUser, (req, res) =>
    res.json({
      invoices: sql(
        "SELECT p.*,s.name FROM platform_paymob_payments p JOIN platform_stores s ON s.id=p.store_id WHERE s.owner_id=? ORDER BY p.created DESC LIMIT 100",
      )
        .all(req.user.id)
        .map((p) => ({
          id: p.id,
          store: p.name,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          created: p.created,
          url: null,
        })),
    }),
  );
}

let retrying = false;
export async function retryPayments() {
  if (!paymobReady || retrying) return;
  retrying = true;
  try {
    for (const row of sql(
      "SELECT * FROM platform_payment_queue WHERE next<=? AND attempts<8 ORDER BY next LIMIT 10",
    ).all(Date.now())) {
      try {
        await reconcileTransaction(row.id);
      } catch (e) {
        sql(
          "UPDATE platform_payment_queue SET attempts=attempts+1,next=?,error=? WHERE id=?",
        ).run(
          Date.now() + Math.min(3600000, 30000 * 2 ** row.attempts),
          e.message.slice(0, 180),
          row.id,
        );
      }
    }
  } finally {
    retrying = false;
  }
}
