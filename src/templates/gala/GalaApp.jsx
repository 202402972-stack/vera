import React, { useEffect, lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useStore } from "@/hooks/useStore";
import CheckoutPage from "@/pages/CheckoutPage";
import SuccessPage from "@/pages/SuccessPage";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import { Toaster } from "@/components/ui/toaster";
import { SavedProvider } from "../form/FormShell";
import RetailAccount from "../form/RetailAccount";
import { GalaProvider, useGala } from "./context";
import { Header, Footer, Cart } from "./GalaShell";
import { Home, Catalog, Collections, Product, Information } from "./GalaPages";
const GalaAdmin = lazy(() => import("./GalaAdmin"));
import "./gala.css";
function CartPage() {
  const { setCartOpen, t } = useGala();
  useEffect(() => setCartOpen(true), [setCartOpen]);
  return (
    <section className="section container">
      <h1>{t("Your cart", "سلتك")}</h1>
      <button className="hero-btn primary" onClick={() => setCartOpen(true)}>
        {t("Open cart", "عرض السلة")}
      </button>
    </section>
  );
}
function Storefront() {
  const { store, config, language } = useGala(),
    location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const p = config.palette;
  const tokens = {
    "--radius": "0px",
    "--th-bg": p.background,
    "--th-surface": p.surface,
    "--th-ink": p.ink,
    "--th-muted": p.muted,
    "--th-primary": p.primary,
    "--th-on-primary": p.onPrimary,
    "--th-accent": p.accent,
    "--th-sale": p.accent,
    "--th-border": p.border,
    "--th-foot-bg": p.footerBackground,
    "--th-foot-ink": p.footerInk,
    "--th-body":
      config.typography.body === "Albert"
        ? "'Albert Sans',sans-serif"
        : "system-ui,sans-serif",
    "--th-display":
      config.typography.heading === "Sans" ? "var(--th-body)" : "Georgia,serif",
    "--gala-width": config.layout.width + "px",
    "--gala-section-scale": config.layout.sectionSpacing / 64,
    "--gala-heading-scale": config.typography.headingScale,
    fontSize: config.typography.bodySize + "px",
  };
  return (
    <div
      dir={language === "ar" ? "rtl" : "ltr"}
      style={tokens}
      className={
        "gala-store gala th th-gala th-hdr-split th-hero-collage th-hero-h-tall th-hero-left th-ov-none th-card-lined th-ratio-" +
        config.layout.cardRatio +
        " th-card-left th-coll-top th-cols-3 th-pdp-stacked th-info-plain th-buybox-plain th-foot-newsletter th-btn-square th-ico-line th-sticky th-shadow-none th-wrap-wide th-cart-drawer"
      }
    >
      <Helmet>
        <title>
          {store.name} — {store.tagline}
        </title>
        <meta name="description" content={store.metaDescription} />
      </Helmet>
      <AnalyticsTracker />
      <Header />
      <main id="gala-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Catalog />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/saved" element={<Catalog saved />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage form />} />
          <Route path="/success" element={<SuccessPage form />} />
          <Route path="/account" element={<RetailAccount />} />
          <Route path="/track" element={<RetailAccount />} />
          {["about", "contact", "shipping", "returns", "privacy", "terms"].map(
            (type) => (
              <Route
                key={type}
                path={"/" + type}
                element={<Information type={type} />}
              />
            ),
          )}
          <Route path="*" element={<Information type="missing" />} />
        </Routes>
      </main>
      <Footer />
      <Cart />
      <Toaster />
    </div>
  );
}
export default function GalaApp() {
  const location = useLocation();
  const { baseStore } = useStore();
  if (location.pathname === "/admin")
    return (
      <Suspense fallback={<p role="status">Opening studio…</p>}>
        <GalaAdmin />
      </Suspense>
    );
  if (!baseStore.gala)
    return <p role="alert">GALA settings are unavailable.</p>;
  return (
    <SavedProvider>
      <GalaProvider>
        <Storefront />
      </GalaProvider>
    </SavedProvider>
  );
}
