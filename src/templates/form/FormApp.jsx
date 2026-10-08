import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useStore } from "@/hooks/useStore";
import AdminPage from "@/pages/AdminPage";
import CheckoutPage from "@/pages/CheckoutPage";
import SuccessPage from "@/pages/SuccessPage";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import { Toaster } from "@/components/ui/toaster";
import { SavedProvider, FormHeader, FormFooter } from "./FormShell";
import { Home, Catalog, Product, Cart, Information } from "./FormPages";
import RetailAccount from "./RetailAccount";
import "./form.css";
export default function FormApp() {
  const location = useLocation(),
    { store } = useStore();
  if (location.pathname === "/admin") return <AdminPage />;
  return (
    <SavedProvider>
      <div className="form-store">
        <Helmet>
          <title>
            {store.name} — {store.tagline}
          </title>
          <meta name="description" content={store.metaDescription} />
        </Helmet>
        <AnalyticsTracker />
        <FormHeader />
        <main id="form-main" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Catalog />} />
            <Route path="/saved" element={<Catalog saved />} />
            <Route path="/product/:id" element={<Product />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<CheckoutPage form />} />
            <Route path="/success" element={<SuccessPage form />} />
            <Route path="/account" element={<RetailAccount />} />
            {[
              "about",
              "contact",
              "shipping",
              "returns",
              "privacy",
              "terms",
            ].map((type) => (
              <Route
                key={type}
                path={`/${type}`}
                element={<Information type={type} />}
              />
            ))}
            <Route path="*" element={<Information type="missing" />} />
          </Routes>
        </main>
        <FormFooter />
        <Toaster />
      </div>
    </SavedProvider>
  );
}
