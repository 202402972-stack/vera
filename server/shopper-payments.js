import { createHmac, timingSafeEqual } from "node:crypto";
import {
  stmt,
  getSetting,
  setSetting,
  encrypt,
  decrypt,
  transaction,
  productById,
  writeProduct,
} from "./db.js";
import { tenantPath } from "./tenant.js";
import { HttpError, text } from "./validation.js";
const base = "https://accept.paymob.com";
const fields = [
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
export function verifyShopperHmac(obj, signature, secret) {
  if (
    !obj ||
    !secret ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{128}$/i.test(signature)
  )
    return false;
  const payload = fields
    .map((key) =>
      key === "order.id"
        ? String(typeof obj.order === "object" ? obj.order.id : obj.order)
        : String(key.split(".").reduce((o, k) => o?.[k], obj) ?? ""),
    )
    .join("");
  return timingSafeEqual(
    createHmac("sha512", secret).update(payload).digest(),
    Buffer.from(signature, "hex"),
  );
}
export function paymentConfig() {
  const c = getSetting("shopper_paymob", {});
  return {
    ...c,
    secretKey: c.secretKey ? decrypt(c.secretKey) : "",
    apiKey: c.apiKey ? decrypt(c.apiKey) : "",
    hmacSecret: c.hmacSecret ? decrypt(c.hmacSecret) : "",
  };
}
export function paymentsReady() {
  const c = paymentConfig();
  return !!(
    c.enabled &&
    c.secretKey &&
    c.apiKey &&
    c.hmacSecret &&
    c.publicKey &&
    c.integrationId &&
    process.env.PUBLIC_URL?.startsWith("https://")
  );
}
async function provider(path, { body, auth } = {}) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: auth } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw new HttpError(
      "Payment provider is unavailable. Your order is saved; try again from its receipt.",
      503,
    );
  return r.json();
}
export async function beginShopperPayment(row) {
  const order = JSON.parse(row.data);
  if (order.payment_method !== "paymob") return null;
  if (order.payment_status === "paid") return null;
  if (order.payment_url) return order.payment_url;
  if (order.payment_attempted)
    throw new HttpError(
      "Payment preparation is awaiting reconciliation. Contact the store before retrying.",
      409,
    );
  if (!paymentsReady())
    throw new HttpError(
      "Online payment is not configured for this store.",
      409,
    );
  const c = paymentConfig(),
    origin = new URL(process.env.PUBLIC_URL).origin,
    reference = order.payment_reference;
  transaction(() => {
    const latest = stmt("SELECT data FROM orders WHERE id=?").get(row.id);
    const data = JSON.parse(latest.data);
    if (data.payment_attempted)
      throw new HttpError("Payment is already preparing.", 409);
    data.payment_attempted = true;
    stmt("UPDATE orders SET data=? WHERE id=?").run(
      JSON.stringify(data),
      row.id,
    );
  });
  const customer = order.customer,
    names = customer.name.split(/\s+/);
  const result = await provider("/v1/intention/", {
    auth: `Token ${c.secretKey}`,
    body: {
      amount: order.total_in_cents,
      currency: order.currency,
      payment_methods: [Number(c.integrationId)],
      special_reference: reference,
      expiration: 3600,
      notification_url: `${origin}${tenantPath()}/api/payments/webhook`,
      redirection_url: `${origin}${tenantPath()}/success#${row.token}`,
      billing_data: {
        first_name: names[0],
        last_name: names.slice(1).join(" ") || names[0],
        phone_number: customer.phone,
        email: customer.email,
        street: customer.address,
        city: customer.city,
        country: customer.country,
        state: customer.region || "",
        apartment: "",
        floor: "",
        building: "",
      },
    },
  });
  if (!result.client_secret || !result.intention_order_id)
    throw new HttpError(
      "Payment preparation needs reconciliation. Contact the store.",
      503,
    );
  const url = `${base}/unifiedcheckout/?publicKey=${encodeURIComponent(c.publicKey)}&clientSecret=${encodeURIComponent(result.client_secret)}`;
  transaction(() => {
    const latest = JSON.parse(
      stmt("SELECT data FROM orders WHERE id=?").get(row.id).data,
    );
    latest.payment_url = url;
    latest.provider_order_id = String(result.intention_order_id);
    stmt("UPDATE orders SET data=? WHERE id=?").run(
      JSON.stringify(latest),
      row.id,
    );
  });
  return url;
}
function releaseOrder(row, state) {
  const order = JSON.parse(row.data);
  if (order.payment_status === "paid" || order.payment_status === "refunded")
    return;
  if (row.status === "cancelled") return;
  for (const item of order.items) {
    const p = productById(item.product_id),
      v = p?.variants.find((v) => v.id === item.variant_id);
    if (v?.manage_inventory) {
      v.inventory_quantity += item.quantity;
      writeProduct(p);
    }
  }
  if (order.coupon_code)
    stmt("UPDATE discounts SET used=MAX(0,used-1) WHERE code=?").run(
      order.coupon_code,
    );
  order.payment_status = state;
  stmt(
    "UPDATE orders SET data=?,status='cancelled',telegram_status='cancelled' WHERE id=?",
  ).run(JSON.stringify(order), row.id);
  stmt("INSERT INTO order_history(order_id,status,at) VALUES(?,?,?)").run(
    row.id,
    "cancelled",
    new Date().toISOString(),
  );
}
export function expireShopperPayments() {
  for (const row of stmt(
    "SELECT * FROM orders WHERE json_extract(data,'$.payment_method')='paymob' AND json_extract(data,'$.payment_status')='pending' AND json_extract(data,'$.payment_expires')<? AND status<>'cancelled'",
  ).all(Date.now()))
    transaction(() => releaseOrder(row, "expired"));
}
export async function reconcileShopperTransaction(id) {
  if (!/^\d{1,30}$/.test(String(id)))
    throw new HttpError("Invalid provider transaction.");
  const c = paymentConfig();
  if (!c.apiKey)
    throw new HttpError("Payment reconciliation is not configured.", 409);
  const auth = await provider("/api/auth/tokens", {
      body: { api_key: c.apiKey },
    }),
    canonical = await provider(`/api/acceptance/transactions/${id}`, {
      auth: `Bearer ${auth.token}`,
    });
  const reference = canonical.order?.merchant_order_id;
  const row = stmt(
    "SELECT * FROM orders WHERE json_extract(data,'$.payment_reference')=?",
  ).get(String(reference || ""));
  if (!row)
    throw new HttpError("Payment reference does not match an order.", 409);
  const order = JSON.parse(row.data);
  if (
    String(canonical.id) !== String(id) ||
    order.payment_method !== "paymob" ||
    Number(canonical.amount_cents) !== order.total_in_cents ||
    canonical.currency !== order.currency ||
    String(canonical.integration_id) !== String(c.integrationId) ||
    (order.provider_order_id &&
      String(canonical.order?.id) !== order.provider_order_id)
  )
    throw new HttpError("Payment details do not match this order.", 409);
  transaction(() => {
    const current = stmt("SELECT * FROM orders WHERE id=?").get(row.id),
      data = JSON.parse(current.data);
    if (canonical.pending) return;
    if (
      canonical.success === true &&
      canonical.is_auth !== true &&
      canonical.is_refunded !== true &&
      canonical.is_voided !== true
    ) {
      if (data.payment_status === "paid") return;
      if (current.status === "cancelled") {
        data.payment_status = "received_after_cancellation";
        data.payment_transaction_id = String(id);
        stmt("UPDATE orders SET data=? WHERE id=?").run(
          JSON.stringify(data),
          row.id,
        );
        return;
      }
      data.payment_status = "paid";
      data.payment_transaction_id = String(id);
      stmt("UPDATE orders SET data=?,telegram_status='pending' WHERE id=?").run(
        JSON.stringify(data),
        row.id,
      );
    } else if (
      (canonical.is_refunded === true || canonical.is_voided === true) &&
      data.payment_status === "paid"
    ) {
      data.payment_status = "refunded";
      data.payment_transaction_id = String(id);
      stmt("UPDATE orders SET data=? WHERE id=?").run(
        JSON.stringify(data),
        row.id,
      );
    } else if (canonical.success === false && data.payment_status !== "paid")
      releaseOrder(current, "failed");
  });
  return { orderId: row.id };
}
export function registerShopperPayments(app, admin, limit) {
  app.get("/api/payments", (_req, res) => {
    expireShopperPayments();
    res.json({ methods: paymentsReady() ? ["cod", "paymob"] : ["cod"] });
  });
  app.get("/api/admin/payments", admin, (_req, res) => {
    const c = paymentConfig();
    res.json({
      enabled: !!c.enabled,
      configured: paymentsReady(),
      publicKey: c.publicKey || "",
      integrationId: c.integrationId || "",
      hasSecretKey: !!c.secretKey,
      hasApiKey: !!c.apiKey,
      hasHmacSecret: !!c.hmacSecret,
      callbackPath: tenantPath() + "/api/payments/webhook",
      httpsReady: !!process.env.PUBLIC_URL?.startsWith("https://"),
    });
  });
  app.put("/api/admin/payments", admin, (req, res, next) => {
    try {
      const previous = getSetting("shopper_paymob", {});
      const c = {
        ...previous,
        enabled: req.body.enabled === true,
        publicKey: text(req.body.publicKey || "", "Public key", 300, false),
        integrationId: text(
          String(req.body.integrationId || ""),
          "Integration ID",
          30,
          false,
        ),
      };
      if (c.integrationId && !/^\d+$/.test(c.integrationId))
        throw new HttpError("Integration ID must contain digits.");
      for (const key of ["secretKey", "apiKey", "hmacSecret"])
        if (req.body[key]) c[key] = encrypt(text(req.body[key], key, 1000));
      if (
        c.enabled &&
        (!c.publicKey ||
          !c.integrationId ||
          !c.secretKey ||
          !c.apiKey ||
          !c.hmacSecret)
      )
        throw new HttpError(
          "Complete the merchant credentials before enabling online payment.",
        );
      setSetting("shopper_paymob", c);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.post(
    "/api/payments/webhook",
    limit("payment-webhook", 300, 60000),
    async (req, res, next) => {
      try {
        const c = paymentConfig();
        if (!verifyShopperHmac(req.body.obj, req.query.hmac, c.hmacSecret))
          throw new HttpError("Invalid payment signature.", 403);
        await reconcileShopperTransaction(req.body.obj.id);
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/admin/payments/reconcile",
    admin,
    limit("payment-reconcile", 20, 60000),
    async (req, res, next) => {
      try {
        res.json(await reconcileShopperTransaction(req.body.transactionId));
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/payments/resume",
    limit("payment-resume", 30, 60000),
    async (req, res, next) => {
      try {
        expireShopperPayments();
        const row = stmt("SELECT * FROM orders WHERE token=?").get(
          text(req.body.token, "Receipt token", 100),
        );
        if (!row || row.status === "cancelled")
          throw new HttpError("Order is not available for payment.", 409);
        res.json({ payment_url: await beginShopperPayment(row) });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/payments/cancel",
    limit("payment-cancel", 30, 60000),
    (req, res, next) => {
      try {
        const row = stmt("SELECT * FROM orders WHERE token=?").get(
          text(req.body.token, "Receipt token", 100),
        );
        if (!row || JSON.parse(row.data).payment_method !== "paymob")
          throw new HttpError("Order not found.", 404);
        const data = JSON.parse(row.data);
        if (data.payment_attempted)
          throw new HttpError(
            "A payment attempt is in progress. Contact the store for reconciliation.",
            409,
          );
        transaction(() => releaseOrder(row, "cancelled"));
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    },
  );
}
