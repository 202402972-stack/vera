import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import React, { lazy, Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import ScrollToTop from "@/components/ScrollToTop.jsx";
import HomePage from "@/pages/HomePage.jsx";
const ProductDetailPage = lazy(() => import("@/pages/ProductDetailPage.jsx"));
const SuccessPage = lazy(() => import("@/pages/SuccessPage.jsx"));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage.jsx"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage.jsx"));
const InfoPage = lazy(() => import("@/pages/InfoPage.jsx"));
import AnalyticsTracker from "@/components/AnalyticsTracker.jsx";
const AdminPage = lazy(() => import("@/pages/AdminPage.jsx"));
import { Toaster } from "@/components/ui/toaster.jsx";
function App() {
  const { t } = useLanguage();
  return localizeView(
    <>
      <ScrollToTop />
      <AnalyticsTracker />
      <Suspense
        fallback={
          <div className="text-center p-12 text-muted-foreground">Loading…</div>
        }
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/shop" element={<HomePage />} />
          <Route path="/about" element={<InfoPage type="about" />} />
          <Route path="/contact" element={<InfoPage type="contact" />} />
          <Route path="/privacy" element={<InfoPage type="privacy" />} />
          <Route path="/terms" element={<InfoPage type="terms" />} />
          <Route path="/shipping" element={<InfoPage type="shipping" />} />
          <Route path="/returns" element={<InfoPage type="returns" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <Toaster />
    </>,
    t,
  );
}
export default App;
