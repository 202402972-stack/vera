import { storeKey } from "@/lib/store-scope";
import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useLocation } from "react-router-dom";
import { useStore } from "@/hooks/useStore";
import { api, formatCurrency } from "@/api/store";
import { motion } from "framer-motion";
import { CheckCircle, Package, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header.jsx";
import Footer from "@/components/Footer.jsx";
const SuccessPage = () => {
  const { t, date, language } = useLanguage();
  const { store } = useStore();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let saved = "";
    try {
      saved = sessionStorage.getItem(storeKey("last-receipt"));
    } catch {}
    const token = location.hash.slice(1) || saved;
    if (!token) {
      setError("No order confirmation is available.");
      return;
    }
    let current = true;
    const reload = () =>
      api(`/receipt/${encodeURIComponent(token)}`)
        .then((data) => {
          if (current) {
            setOrder(data);
            setError("");
          }
        })
        .catch((err) => {
          if (current) setError(err.message);
        });
    reload();
    const timer = setInterval(reload, 30000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [location.hash]);
  const money = (amount) =>
    formatCurrency(amount, {
      symbol: order?.symbol,
      decimal_digits: 2,
    });
  return localizeView(
    <>
      <Helmet>
        <title>Order Confirmed - {store.name}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta
          name="description"
          content={`Thank you for your purchase from ${store.name}`}
        />
      </Helmet>

      <Header />

      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-[70vh] flex items-center justify-center px-4 py-20"
      >
        <motion.div
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.6,
          }}
          className="max-w-2xl w-full text-center"
        >
          <motion.div
            initial={{
              scale: 0,
            }}
            animate={{
              scale: 1,
            }}
            transition={{
              delay: 0.2,
              type: "spring",
              stiffness: 200,
              damping: 15,
            }}
            className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-8"
          >
            {order && <CheckCircle className="h-12 w-12 text-primary" />}
          </motion.div>

          <motion.h1
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            transition={{
              delay: 0.3,
              duration: 0.6,
            }}
            className="text-4xl md:text-5xl font-semibold mb-6 text-foreground"
          >
            {order
              ? "Thank you for your purchase"
              : error
                ? "Order confirmation"
                : "Loading your order…"}
          </motion.h1>

          <motion.p
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            transition={{
              delay: 0.4,
              duration: 0.6,
            }}
            className="text-lg text-muted-foreground mb-10 mx-auto max-w-lg leading-relaxed"
          >
            {order
              ? order.delivery_note
              : error || "Retrieving your order details…"}
          </motion.p>

          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            transition={{
              delay: 0.5,
              duration: 0.6,
            }}
            className="bg-card border border-border rounded-2xl p-8 mb-10 shadow-sm"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <Package className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-medium text-foreground">
                Order Details
              </h2>
            </div>
            {order && (
              <div className="text-left text-sm space-y-4">
                <div className="flex justify-between">
                  <strong>{order.number}</strong>
                  <span className="text-muted-foreground">
                    {date(order.created_at, { dateStyle: "medium" })}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  Cash on delivery · {order.status}
                </p>
                {order.status !== "cancelled" && (
                  <ol
                    className="order-timeline"
                    aria-label={t("Order progress")}
                  >
                    {["new", "processing", "shipped", "delivered"].map(
                      (status, i) => (
                        <li
                          key={status}
                          className={
                            i <=
                            [
                              "new",
                              "processing",
                              "shipped",
                              "delivered",
                            ].indexOf(order.status)
                              ? "complete"
                              : ""
                          }
                          aria-current={
                            order.status === status ? "step" : undefined
                          }
                        >
                          {t(status)}
                        </li>
                      ),
                    )}
                  </ol>
                )}
                {order.tracking &&
                  (order.tracking.number || order.tracking.url) && (
                    <div className="order-tracking">
                      <strong>{t("Shipment tracking")}</strong>
                      <p>
                        {order.tracking.carrier} · {order.tracking.number}
                      </p>
                      {order.tracking.url && (
                        <a
                          className="underline"
                          href={order.tracking.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Track shipment
                        </a>
                      )}
                    </div>
                  )}
                {order.items.map((item) => (
                  <div
                    key={item.variant_id}
                    className="flex items-center gap-4 py-3 border-t border-border"
                  >
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-16 h-20 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <strong>{item.title}</strong>
                      <p className="text-muted-foreground">
                        {item.variant_title} · {item.quantity} ×{" "}
                        {money(item.price_in_cents)}
                      </p>
                    </div>
                    <span>{money(item.total_in_cents)}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-4 space-y-2">
                  <p>Subtotal: {money(order.subtotal_in_cents)}</p>
                  {!!order.discount_in_cents && (
                    <p>
                      {t("Discount")} ({order.coupon_code}): −
                      {money(order.discount_in_cents)}
                    </p>
                  )}
                  {!!order.tax_in_cents && (
                    <p>
                      {language === "ar" ? order.tax_label_ar : order.tax_label}
                      : {money(order.tax_in_cents)}
                    </p>
                  )}
                  <p>Delivery: {money(order.shipping_in_cents)}</p>
                  <p className="font-semibold text-lg">
                    Total due on delivery: {money(order.total_in_cents)}
                  </p>
                </div>
                <div className="border-t border-border pt-4">
                  <strong>Delivery to {order.customer.name}</strong>
                  <p className="text-muted-foreground">
                    <bdi dir="ltr">{order.customer.phone}</bdi>
                    <br />
                    <bdi dir="ltr">{order.customer.email}</bdi>
                    <br />
                    {order.customer.address}
                    <br />
                    {order.customer.city}, {order.customer.region}{" "}
                    {order.customer.postalCode}, {order.customer.country}
                  </p>
                  {order.customer.location && (
                    <a
                      href={order.customer.location}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      View delivery location
                    </a>
                  )}
                  {order.customer.notes && (
                    <p className="text-muted-foreground mt-2">
                      Notes: {order.customer.notes}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Save your order number. Keep this confirmation link private;
                  it contains your delivery information.
                </p>
              </div>
            )}
            {error && (
              <p className="text-destructive" role="alert">
                {error}
              </p>
            )}
          </motion.div>

          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            transition={{
              delay: 0.6,
              duration: 0.6,
            }}
          >
            <Button
              asChild
              size="lg"
              className="bg-primary hover:bg-[hsl(var(--primary-dark))] text-primary-foreground font-medium px-8 py-6 text-lg rounded-xl group transition-colors"
            >
              <Link to="/" className="inline-flex items-center gap-2">
                Continue Shopping
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </main>

      <Footer />
    </>,
    t,
  );
};
export default SuccessPage;
