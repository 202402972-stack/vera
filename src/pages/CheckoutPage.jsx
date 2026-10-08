import { storeKey } from "@/lib/store-scope";
import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Banknote,
  CreditCard,
  ArrowLeft,
  Package,
  LockKeyhole,
  Loader2,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Field, Notice } from "@/components/admin/AdminUI";
import { useCart } from "@/hooks/useCart";
import { useStore } from "@/hooks/useStore";
import {
  api,
  jsonRequest,
  getProducts,
  initializeCheckout,
  formatCurrency,
} from "@/api/store";
import { track, flush, analyticsIdentity } from "@/lib/analytics";
import "@/admin.css";
export default function CheckoutPage({ form = false }) {
  const ContentTag = form ? "section" : "main";
  const { t, language } = useLanguage();
  const { cartItems, clearCart } = useCart();
  const { store } = useStore();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    region: "",
    postalCode: "",
    country: "",
    location: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [lines, setLines] = useState([]),
    [loading, setLoading] = useState(true);
  const [methods, setMethods] = useState(["cod"]),
    [paymentMethod, setPaymentMethod] = useState("cod");
  useEffect(() => {
    let active = true;
    api("/retail/session")
      .then(({ customer: shopper }) => {
        if (active && shopper)
          setCustomer((prev) => ({
            ...prev,
            name: prev.name || shopper.name,
            email: prev.email || shopper.email,
          }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    api("/payments")
      .then((d) => setMethods(d.methods))
      .catch(() => {});
  }, []);
  const [couponInput, setCouponInput] = useState(""),
    [coupon, setCoupon] = useState("");
  const [quote, setQuote] = useState(null),
    [quoteError, setQuoteError] = useState(""),
    [quoting, setQuoting] = useState(true);
  const cartSignature = JSON.stringify(
    cartItems.map((i) => ({ variant_id: i.variant.id, quantity: i.quantity })),
  );
  useEffect(() => {
    if (!cartItems.length) {
      setQuoting(false);
      return;
    }
    const controller = new AbortController();
    setQuoting(true);
    setQuoteError("");
    setQuote(null);
    const timer = setTimeout(() => {
      api("/checkout/quote", {
        ...jsonRequest("POST", {
          items: JSON.parse(cartSignature),
          coupon_code: coupon,
          country: customer.country,
        }),
        signal: controller.signal,
      })
        .then(setQuote)
        .catch((e) => {
          if (e.name !== "AbortError") setQuoteError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setQuoting(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [cartSignature, cartItems.length, coupon, customer.country]);
  const [key] = useState(() => {
    try {
      const old = sessionStorage.getItem(storeKey("checkout-key"));
      const value = old || crypto.randomUUID();
      sessionStorage.setItem(storeKey("checkout-key"), value);
      return value;
    } catch {
      return crypto.randomUUID();
    }
  });
  useEffect(() => {
    if (!cartItems.length) {
      setLines([]);
      setLoading(false);
      return;
    }
    track("checkout_start");
    flush();
    getProducts({ ids: cartItems.map((item) => item.product.id) })
      .then((data) => {
        setLines(
          cartItems.map((item) => {
            const product = data.products.find((p) => p.id === item.product.id);
            const variant = product?.variants.find(
              (v) => v.id === item.variant.id,
            );
            return {
              ...item,
              product: product || item.product,
              variant: variant || item.variant,
              unavailable:
                !variant ||
                !product.purchasable ||
                (variant.manage_inventory &&
                  variant.inventory_quantity < item.quantity),
            };
          }),
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [cartItems]);
  const currency = {
    symbol: store.checkout.symbol,
    decimal_digits: 2,
  };
  const money = (value) => formatCurrency(value, currency);
  const subtotal = lines.reduce(
    (total, item) =>
      total +
      (item.variant.sale_price_in_cents ?? item.variant.price_in_cents) *
        item.quantity,
    0,
  );
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await flush();
      const result = await initializeCheckout({
        idempotency_key: key,
        coupon_code: coupon,
        language,
        analytics: analyticsIdentity(),
        customer,
        payment_method: paymentMethod,
        items: cartItems.map((i) => ({
          variant_id: i.variant.id,
          quantity: i.quantity,
        })),
      });
      try {
        sessionStorage.setItem(storeKey("last-receipt"), result.receipt_token);
        sessionStorage.removeItem(storeKey("checkout-key"));
      } catch {}
      track("order_created", result.order.number, result.order.total_in_cents);
      flush();
      clearCart();
      if (result.payment_url) {
        window.location.assign(result.payment_url);
        return;
      }
      navigate(`/success#${result.receipt_token}`, {
        replace: true,
      });
    } catch (err) {
      setError(err.message);
      track("checkout_error", err.message);
    } finally {
      setBusy(false);
    }
  }
  return localizeView(
    <>
      <Helmet>
        <title>Checkout - {store.name}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      {!form && <Header />}
      <ContentTag
        id="main-content"
        tabIndex={-1}
        className="admin-scope max-w-6xl mx-auto px-4 sm:px-6 py-12"
      >
        <Link
          to={form ? "/shop" : "/"}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-8"
        >
          <ArrowLeft size={16} /> Back to collection
        </Link>
        <motion.div
          initial={{
            opacity: 0,
            y: 16,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
        >
          <h1 className="text-4xl md:text-5xl mb-3">
            Your next favourite, on its way.
          </h1>
          <p className="text-muted-foreground mb-10">
            Enter your delivery details to place your order.
          </p>
          {!cartItems.length ? (
            <div className="admin-panel text-center py-12">
              <Package size={36} className="mx-auto mb-4 text-primary" />
              <p>Your cart is empty.</p>
              <Button asChild className="mt-5">
                <Link to="/">Explore the collection</Link>
              </Button>
            </div>
          ) : (
            <form
              onSubmit={submit}
              className="grid lg:grid-cols-[1.4fr_1fr] gap-8"
            >
              <div className="space-y-6">
                <section className="admin-panel">
                  <h2 className="text-2xl mb-6">Delivery information</h2>
                  <div className="grid sm:grid-cols-2 gap-5">
                    {[
                      ["name", "Full name", 120, true],
                      ["phone", "Phone number", 60, true],
                      [
                        "email",
                        paymentMethod === "paymob"
                          ? "Email"
                          : "Email (optional)",
                        200,
                        paymentMethod === "paymob",
                      ],
                      ["country", "Country", 100, true],
                    ].map(([field, label, max, required]) =>
                      field === "country" &&
                      store.commerce?.allowedCountries?.length ? (
                        <Field key={field} label="Country">
                          <select
                            aria-label={t("Country")}
                            required
                            autoComplete="country-name"
                            value={customer.country}
                            onChange={(e) =>
                              setCustomer({
                                ...customer,
                                country: e.target.value,
                              })
                            }
                          >
                            <option value="">Choose a country</option>
                            {store.commerce.allowedCountries.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ) : (
                        <Field
                          key={field}
                          label={label}
                          value={customer[field]}
                          onChange={(value) =>
                            setCustomer({
                              ...customer,
                              [field]: value,
                            })
                          }
                          maxLength={max}
                          required={required}
                          autoComplete={
                            {
                              name: "name",
                              phone: "tel",
                              email: "email",
                              country: "country-name",
                            }[field]
                          }
                          type={
                            field === "email"
                              ? "email"
                              : field === "phone"
                                ? "tel"
                                : "text"
                          }
                        />
                      ),
                    )}
                  </div>
                  <Field
                    label="Street address / building / apartment"
                    value={customer.address}
                    onChange={(address) =>
                      setCustomer({
                        ...customer,
                        address,
                      })
                    }
                    required
                    maxLength={400}
                    autoComplete="street-address"
                  />
                  <div className="grid sm:grid-cols-3 gap-4">
                    {[
                      ["city", "City", true],
                      ["region", "State / region", false],
                      ["postalCode", "Postal code", false],
                    ].map(([field, label, required]) => (
                      <Field
                        key={field}
                        label={label}
                        value={customer[field]}
                        onChange={(value) =>
                          setCustomer({
                            ...customer,
                            [field]: value,
                          })
                        }
                        required={required}
                        maxLength={field === "postalCode" ? 30 : 100}
                      />
                    ))}
                  </div>
                  <Field
                    label="Map link (optional)"
                    hint="Paste a Google Maps or Apple Maps link so we can find you easily."
                    value={customer.location}
                    onChange={(location) =>
                      setCustomer({
                        ...customer,
                        location,
                      })
                    }
                    maxLength={500}
                  />
                  <Field
                    label="Delivery notes (optional)"
                    hint="Landmarks, delivery instructions or a preferred contact time."
                    value={customer.notes}
                    onChange={(notes) =>
                      setCustomer({
                        ...customer,
                        notes,
                      })
                    }
                    multiline
                    maxLength={1000}
                  />
                </section>
                <section className="admin-panel">
                  <h2 className="text-2xl mb-5">Payment method</h2>
                  <label className="flex items-center gap-4 rounded-xl border border-primary bg-primary/5 p-4">
                    <input
                      type="radio"
                      checked={paymentMethod === "cod"}
                      onChange={() => setPaymentMethod("cod")}
                      name="payment"
                    />
                    <Banknote className="text-primary" />
                    <span>
                      <strong className="block text-sm">
                        Cash on delivery
                      </strong>
                      <span className="text-xs text-muted-foreground">
                        Pay when you receive your order.
                      </span>
                    </span>
                  </label>
                  {methods.includes("paymob") && (
                    <label className="flex items-center gap-4 rounded-xl border p-4 mt-3">
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === "paymob"}
                        onChange={() => setPaymentMethod("paymob")}
                      />
                      <CreditCard />
                      <span>
                        <strong className="block text-sm">
                          {language === "ar"
                            ? "الدفع الإلكتروني عبر Paymob"
                            : "Online payment with Paymob"}
                        </strong>
                        <span className="text-xs text-muted-foreground">
                          {language === "ar"
                            ? "إتمام الدفع على صفحة Paymob الآمنة."
                            : "Complete payment on Paymob’s secure checkout."}
                        </span>
                      </span>
                    </label>
                  )}
                </section>
              </div>
              <aside className="admin-panel h-fit lg:sticky lg:top-28">
                <h2 className="text-2xl mb-6">Your order</h2>
                <div className="flex gap-2 items-end mb-5">
                  <div className="flex-1">
                    <Field
                      label="Discount code"
                      value={couponInput}
                      maxLength={32}
                      onChange={setCouponInput}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mb-6"
                    disabled={quoting || !couponInput.trim()}
                    onClick={() => setCoupon(couponInput.trim().toUpperCase())}
                  >
                    Apply
                  </Button>
                </div>
                {coupon && (
                  <button
                    type="button"
                    className="text-xs underline mb-4"
                    onClick={() => {
                      setCoupon("");
                      setCouponInput("");
                    }}
                  >
                    {t("Remove discount")} · {coupon}
                  </button>
                )}
                {quoteError && <Notice error>{quoteError}</Notice>}
                {loading ? (
                  <Loader2 className="animate-spin mx-auto" />
                ) : (
                  lines.map((item) => (
                    <div
                      key={item.variant.id}
                      className="flex gap-4 py-4 border-b border-border"
                    >
                      <img
                        src={item.product.image}
                        alt={item.product.title}
                        className="w-16 h-20 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <strong className="text-sm">
                          {item.product.title}
                        </strong>
                        <p className="text-xs text-muted-foreground">
                          {item.variant.title} · Qty {item.quantity}
                        </p>
                        <p className="text-sm mt-2">
                          {money(
                            (item.variant.sale_price_in_cents ??
                              item.variant.price_in_cents) * item.quantity,
                          )}
                        </p>
                        {item.unavailable && (
                          <span className="text-xs text-destructive">
                            Unavailable. Please remove this item from your cart.
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div className="space-y-3 py-6 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{money(subtotal)}</span>
                  </div>
                  {!!quote?.discount_in_cents && (
                    <div className="flex justify-between">
                      <span>
                        {t("Discount")} · {quote.coupon_code}
                      </span>
                      <span>−{money(quote.discount_in_cents)}</span>
                    </div>
                  )}
                  {!!quote?.tax_in_cents && (
                    <div className="flex justify-between">
                      <span>
                        {language === "ar"
                          ? quote.tax_label_ar
                          : quote.tax_label}
                      </span>
                      <span>{money(quote.tax_in_cents)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Delivery</span>
                    <span>
                      {quote
                        ? quote.shipping_in_cents
                          ? money(quote.shipping_in_cents)
                          : t("Free")
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-4 text-lg font-semibold">
                    <span>Total</span>
                    <span>
                      {quoting
                        ? t("Updating…")
                        : quote
                          ? money(quote.total_in_cents)
                          : "—"}
                    </span>
                  </div>
                </div>
                {error && <Notice error>{error}</Notice>}
                <Button
                  className="w-full py-6 rounded-xl"
                  type="submit"
                  disabled={
                    busy ||
                    loading ||
                    quoting ||
                    !quote ||
                    lines.some((i) => i.unavailable)
                  }
                >
                  {busy ? (
                    <Loader2 size={18} className="animate-spin mr-2" />
                  ) : (
                    <Banknote size={18} className="mr-2" />
                  )}
                  {busy
                    ? "Placing order…"
                    : paymentMethod === "paymob"
                      ? language === "ar"
                        ? "المتابعة إلى الدفع"
                        : "Continue to payment"
                      : "Place order · Cash on delivery"}
                </Button>
                <p className="text-xs text-muted-foreground mt-4">
                  {store.checkout.deliveryNote}
                </p>
                <p className="text-xs text-muted-foreground mt-4 flex gap-2">
                  <LockKeyhole size={14} /> By placing your order, you agree to
                  our{" "}
                  <Link to="/terms" className="underline">
                    terms
                  </Link>
                  .
                </p>
              </aside>
            </form>
          )}
        </motion.div>
      </ContentTag>
      {!form && <Footer />}
    </>,
    t,
  );
}
