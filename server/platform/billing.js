import { stripePlan } from "./pricing.js";
import Stripe from "stripe";
import express from "express";
import { sql, audit } from "./core.js";
import { requireUser } from "./auth.js";
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      maxNetworkRetries: 2,
      timeout: 20000,
    })
  : null;
export const billingReady = !!(
  stripe &&
  process.env.STRIPE_PRICE_ID &&
  process.env.STRIPE_WEBHOOK_SECRET
);
export function registerWebhook(app) {
  app.post(
    "/api/platform/billing/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      if (!billingReady) return res.sendStatus(503);
      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          req.headers["stripe-signature"],
          process.env.STRIPE_WEBHOOK_SECRET,
        );
      } catch {
        return res.sendStatus(400);
      }
      if (
        sql("SELECT id FROM platform_billing_events WHERE id=?").get(event.id)
      )
        return res.json({ received: true });
      try {
        if (
          [
            "customer.subscription.created",
            "customer.subscription.updated",
            "customer.subscription.deleted",
          ].includes(event.type)
        ) {
          // Fetch canonical state so delayed webhook events cannot restore an old entitlement.
          const sub = await stripe.subscriptions.retrieve(event.data.object.id);
          const store = sql("SELECT * FROM platform_stores WHERE id=?").get(
            Number(sub.metadata.storeId),
          );
          const snapshot = JSON.parse(store?.billing_plan_snapshot || "null");
          const item = sub.items.data.find(
            (i) =>
              i.price.id ===
                (snapshot?.provider_reference || process.env.STRIPE_PRICE_ID) &&
              (!snapshot ||
                (i.price.currency.toUpperCase() === snapshot.currency &&
                  i.price.unit_amount === snapshot.amount_minor)),
          );
          if (
            store &&
            item &&
            store.customer === sub.customer &&
            String(store.owner_id) === sub.metadata.userId &&
            (!store.subscription || store.subscription === sub.id)
          ) {
            const until = ["active", "trialing"].includes(sub.status)
              ? Number(item.current_period_end || sub.current_period_end) * 1000
              : 0;
            if (!Number.isFinite(until))
              throw new Error("Missing subscription expiry");
            sql(
              "UPDATE platform_stores SET subscription=?,billing_status=?,access_until=? WHERE id=?",
            ).run(sub.id, sub.status, until, store.id);
            audit(null, "billing." + sub.status, store.id);
          }
        }
        sql(
          "INSERT OR IGNORE INTO platform_billing_events(id,at) VALUES(?,?)",
        ).run(event.id, Date.now());
        res.json({ received: true });
      } catch (e) {
        console.error("Billing webhook failed:", e.name);
        res.sendStatus(500);
      }
    },
  );
}
export function registerBilling(app, owned, rate) {
  app.post(
    "/api/platform/stores/:id/checkout",
    requireUser,
    rate,
    owned,
    async (req, res, next) => {
      try {
        if (!billingReady)
          return res
            .status(503)
            .json({ error: "Subscriptions are not configured yet." });
        const store = req.store;
        if (store.subscription) {
          const sub = await stripe.subscriptions.retrieve(store.subscription);
          if (!["canceled", "incomplete_expired"].includes(sub.status))
            return res.status(409).json({
              error: "Manage your existing subscription through billing.",
            });
        }
        if (store.checkout) {
          const old = await stripe.checkout.sessions.retrieve(store.checkout);
          if (old.status === "open") return res.json({ url: old.url });
          if (old.status === "complete" && !store.subscription)
            return res.status(409).json({
              error: "Payment is being confirmed. Please refresh shortly.",
            });
        }
        let customer = store.customer;
        if (!customer) {
          customer = (
            await stripe.customers.create(
              {
                email: req.user.email,
                name: req.user.name,
                metadata: {
                  userId: String(req.user.id),
                  storeId: String(store.id),
                },
              },
              { idempotencyKey: "customer-store-" + store.id },
            )
          ).id;
          sql("UPDATE platform_stores SET customer=? WHERE id=?").run(
            customer,
            store.id,
          );
        }
        const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID);
        const plan = stripePlan(price);
        if (req.body.planId && req.body.planId !== plan.id)
          return res
            .status(409)
            .json({
              error:
                "The billing plan changed. Review the actual charge again.",
            });
        sql(
          "UPDATE platform_stores SET billing_plan_snapshot=? WHERE id=?",
        ).run(JSON.stringify(plan), store.id);
        const session = await stripe.checkout.sessions.create(
          {
            mode: "subscription",
            customer,
            line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
            subscription_data: {
              metadata: {
                storeId: String(store.id),
                userId: String(req.user.id),
              },
            },
            success_url:
              process.env.PUBLIC_URL + "/workspace?billing=processing",
            cancel_url: process.env.PUBLIC_URL + "/workspace",
            client_reference_id: String(store.id),
          },
          {
            idempotencyKey:
              "checkout-" + store.id + "-" + (store.checkout || "initial"),
          },
        );
        sql("UPDATE platform_stores SET checkout=? WHERE id=?").run(
          session.id,
          store.id,
        );
        res.json({ url: session.url });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/platform/stores/:id/billing",
    requireUser,
    rate,
    owned,
    async (req, res, next) => {
      try {
        if (!billingReady || !req.store.customer)
          return res
            .status(400)
            .json({ error: "No billing account for this store yet." });
        const session = await stripe.billingPortal.sessions.create({
          customer: req.store.customer,
          return_url: process.env.PUBLIC_URL + "/workspace",
        });
        res.json({ url: session.url });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get("/api/platform/invoices", requireUser, async (req, res, next) => {
    try {
      if (!billingReady) return res.json({ invoices: [] });
      const stores = sql(
        "SELECT id,name,customer FROM platform_stores WHERE owner_id=? AND customer IS NOT NULL",
      ).all(req.user.id);
      const lists = await Promise.all(
        stores.map(async (s) =>
          (
            await stripe.invoices.list({ customer: s.customer, limit: 10 })
          ).data.map((i) => ({
            id: i.id,
            store: s.name,
            status: i.status,
            amount: i.total,
            currency: i.currency,
            url: i.hosted_invoice_url,
            created: i.created * 1000,
          })),
        ),
      );
      res.json({
        invoices: lists.flat().sort((a, b) => b.created - a.created),
      });
    } catch (e) {
      next(e);
    }
  });
}
