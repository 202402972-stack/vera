import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
process.env.DATA_DIR = mkdtempSync(
  path.join(os.tmpdir(), "vera-billing-test-"),
);
process.env.NODE_ENV = "test";
process.env.PLATFORM_MODE = "1";
process.env.BILLING_PROVIDER = "paymob";
for (const [k, v] of Object.entries({
  PAYMOB_SECRET_KEY: "sk-test",
  PAYMOB_PUBLIC_KEY: "pk-test",
  PAYMOB_API_KEY: "api-test",
  PAYMOB_HMAC_SECRET: "hmac-test",
  PAYMOB_INTEGRATION_ID: "12",
  PAYMOB_MOTO_ID: "13",
  PAYMOB_PLAN_ID: "77",
  PAYMOB_AMOUNT_CENTS: "150",
  PAYMOB_CURRENCY: "USD",
}))
  process.env[k] = v;
let core, billing, db, store;
let txn, subscription;
const originalFetch = globalThis.fetch;
before(async () => {
  core = await import("../server/platform/core.js");
  billing = await import("../server/platform/paymob.js");
  db = await import("../server/db.js");
  core
    .sql("INSERT INTO platform_users(sub,email,name,created) VALUES(?,?,?,?)")
    .run("payer", "payer@example.test", "Payer", Date.now());
  const user = core.sql("SELECT * FROM platform_users").get();
  store = core.provision(user, {
    name: "Billing test",
    slug: "billing-test",
    template: "atelier",
    password: "private-password-1234",
  });
  core
    .sql(
      "INSERT INTO platform_paymob_checkouts(reference,store_id,order_id,expires,created) VALUES(?,?,?,?,?)",
    )
    .run("reference", store.id, "100", Date.now() + 3600000, Date.now());
  globalThis.fetch = async (url) => {
    const u = String(url);
    let data;
    if (u.endsWith("/api/auth/tokens")) data = { token: "server-token" };
    else if (u.includes("/transactions/")) data = txn;
    else if (u.includes("/subscriptions?transaction="))
      data = { results: [subscription] };
    else throw new Error("Unexpected payment API request");
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  };
});
after(() => {
  globalThis.fetch = originalFetch;
  db.rawDb.close();
  rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});
const state = () =>
  core.sql("SELECT * FROM platform_stores WHERE id=?").get(store.id);
test("canonical payment validation rejects underpayments, wrong currencies and mismatched plans", async () => {
  txn = {
    id: 20,
    order: { id: 100 },
    amount_cents: 1,
    currency: "USD",
    integration_id: 12,
    success: true,
    pending: false,
    created_at: new Date().toISOString(),
  };
  subscription = { id: 30, plan: 77, state: "active" };
  await assert.rejects(billing.reconcileTransaction(20), /amount/);
  assert.equal(state().access_until, 0);
  txn.amount_cents = 150;
  txn.currency = "EGP";
  await assert.rejects(billing.reconcileTransaction(20), /currency/);
  txn.currency = "USD";
  subscription.plan = 99;
  await assert.rejects(billing.reconcileTransaction(20), /plan/);
  subscription.plan = 77;
});
test("verified payment activates exactly one paid period; replays never extend it", async () => {
  await billing.reconcileTransaction(20);
  const first = state();
  assert.equal(first.subscription, "paymob:30");
  assert.equal(first.access_until, Date.parse(txn.created_at) + 30 * 86400000);
  await billing.reconcileTransaction(20);
  assert.equal(state().access_until, first.access_until);
  assert.equal(
    core.sql("SELECT count(*) n FROM platform_paymob_payments").get().n,
    1,
  );
});
test("recurring transactions map by verified subscription, and refunds revoke only refunded entitlement", async () => {
  txn = {
    ...txn,
    id: 21,
    order: { id: 101 },
    integration_id: 13,
    created_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  };
  await billing.reconcileTransaction(21);
  const renewal = state().access_until;
  assert.equal(
    core.sql("SELECT count(*) n FROM platform_paymob_payments").get().n,
    2,
  );
  txn.is_refunded = true;
  await billing.reconcileTransaction(21);
  assert.ok(state().access_until < renewal);
  assert.equal(
    core.sql("SELECT status FROM platform_paymob_payments WHERE id=?").get("21")
      .status,
    "refunded",
  );
});
test("pending and unrelated subscription payments cannot unlock a store", async () => {
  const before = state().access_until;
  txn = { ...txn, id: 22, is_refunded: false, pending: true };
  await billing.reconcileTransaction(22);
  assert.equal(state().access_until, before);
  subscription.id = 31;
  await assert.rejects(billing.reconcileTransaction(22), /Unrecognized/);
  assert.equal(state().access_until, before);
});

test("persistent confirmation queue retries transient errors and clears after verified reconciliation", async () => {
  subscription = { id: 30, plan: 77, state: "active" };
  txn = { ...txn, id: 23, pending: false, success: true };
  core
    .sql("INSERT INTO platform_payment_queue(id,next) VALUES(?,?)")
    .run("23", Date.now() - 1);
  await billing.retryPayments();
  assert.equal(
    core.sql("SELECT id FROM platform_payment_queue WHERE id=?").get("23"),
    undefined,
  );
  core
    .sql("INSERT INTO platform_payment_queue(id,next) VALUES(?,?)")
    .run("24", Date.now() - 1);
  await billing.retryPayments();
  const retry = core
    .sql("SELECT * FROM platform_payment_queue WHERE id=?")
    .get("24");
  assert.equal(retry.attempts, 1);
  assert.ok(retry.next > Date.now());
  assert.match(retry.error, /mismatch/);
});
