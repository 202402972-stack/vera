import { useDialog } from "@/templates/gala/context";
import "@/workspace/workspace.css";
import { StorePreview, StoreImports } from "@/workspace/StoreTools";
import { Inbox } from "@/templates/gala/GalaAdmin";
import FinancialSettings from "@/components/admin/FinancialSettings";
import CollectionsPanel from "@/components/admin/CollectionsPanel";
import {
  useStoreApi,
  Link,
  useAdminNavigation,
  useStoreScope,
} from "@/workspace/StoreScope";
import { UploadContext } from "@/components/admin/UploadContext";
import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import React, { useEffect, useState, useRef } from "react";
import { Helmet } from "react-helmet";

import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Type,
  Settings,
  BarChart3,
  Send,
  ArrowUpRight,
  LogOut,
  Palette,
  SlidersHorizontal,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { jsonRequest } from "@/api/store";
import { useStore } from "@/hooks/useStore";
import { Notice, Busy } from "@/components/admin/AdminUI";
import BrandStudio from "@/components/admin/BrandStudio";
import CommercePanel from "@/components/admin/CommercePanel";
import OperationsPanel from "@/components/admin/OperationsPanel";
import AnalyticsPanel from "@/components/admin/AnalyticsPanel";
import ProductsEditor from "@/components/admin/ProductsEditor";
import ContentEditor from "@/components/admin/ContentEditor";
import OrdersPanel from "@/components/admin/OrdersPanel";
import IntegrationsPanel from "@/components/admin/IntegrationsPanel";
import AdminLogin from "@/components/admin/AdminLogin";
import useScrollHeader from "@/hooks/useScrollHeader";
import "@/admin.css";
import FormDesign from "@/components/admin/FormDesign";
import RetailPanel from "@/components/admin/RetailPanel";
import PaymentsPanel from "@/components/admin/PaymentsPanel";
const tabs = [
  ["overview", "Overview", LayoutDashboard],
  ["orders", "Orders", ShoppingBag],
  ["products", "Products", Package],
  ["brand", "Brand studio", Palette],
  ["commerce", "Commerce", SlidersHorizontal],
  ["content", "Store content", Type],
  ["footer", "Footer & settings", Settings],
  ["analytics", "Analytics", BarChart3],
  ["integrations", "Connections", Send],
  ["design", "Store design", Palette],
  ["customers", "Customers", ShoppingBag],
  ["reviews", "Reviews", Type],
  ["returns", "Returns & exchanges", Package],
  ["payments", "Payments", SlidersHorizontal],
  ["preview", "Preview", Palette],
  ["imports", "Import history", Package],
  ["finance", "Financial settings", SlidersHorizontal],
  ["collections", "Collections", Package],
  ["messages", "Messages", Send],
  ["newsletter", "Newsletter", Send],
];
export default function AdminPage() {
  const api = useStoreApi();
  const scope = useStoreScope();
  const { t, language, setLanguage } = useLanguage();
  const { store } = useStore();
  const [navOpen, setNavOpen] = useState(false),
    navRef = useRef(null);
  useDialog(navOpen, navRef, () => setNavOpen(false));
  const isForm = store._template?.renderer === "form";
  const availableTabs = tabs.filter(
    ([id]) =>
      (!["preview", "imports"].includes(id) || scope),
  );
  const copy = (en, ar) => (language === "ar" ? ar : en);
  const [uploadCount, setUploadCount] = useState(0);
  const [session, setSession] = useState(null),
    [checking, setChecking] = useState(true),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const { headerRef, hidden, reveal } = useScrollHeader(false);
  const [params, setParams] = useAdminNavigation();
  const tab = availableTabs.some(([id]) => id === params.get("tab"))
    ? params.get("tab")
    : "overview";
  useEffect(() => {
    const expired = (e) => {
      if ((e.detail?.storeId || null) === (scope?.storeId || null))
        setSession(null);
    };
    window.addEventListener("admin-session-expired", expired);
    return () => window.removeEventListener("admin-session-expired", expired);
  }, [scope?.storeId]);
  useEffect(() => {
    api("/admin/session")
      .then(setSession)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [api]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    const warn = (e) => {
      if (document.querySelector('[data-dirty="true"]')) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        "/admin/login",
        jsonRequest("POST", {
          password,
        }),
      );
      setPassword("");
      setSession(await api("/admin/session"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function canLeave() {
    return (
      !document.querySelector('[data-dirty="true"]') ||
      window.confirm(t("Discard your unsaved changes?"))
    );
  }
  async function logout() {
    try {
      await api("/admin/logout", {
        method: "POST",
      });
      setSession(null);
      setMessage("");
    } catch (e) {
      setError(e.message);
    }
  }
  const content = {
    preview: <StorePreview />,
    imports: scope ? <StoreImports /> : null,
    design: isForm ? (
      <FormDesign notify={setMessage} />
    ) : (
      <BrandStudio notify={setMessage} />
    ),
    customers: <RetailPanel kind="customers" notify={setMessage} />,
    reviews: <RetailPanel kind="reviews" notify={setMessage} />,
    returns: <RetailPanel kind="returns" notify={setMessage} />,
    payments: <PaymentsPanel notify={setMessage} />,
    messages: <Inbox kind="messages" notify={setMessage} />,
    newsletter: <Inbox kind="newsletter" notify={setMessage} />,
    finance: <FinancialSettings notify={setMessage} />,
    collections: <CollectionsPanel />,
    settings: <CommercePanel notify={setMessage} />,
    overview: <OperationsPanel />,
    brand: <BrandStudio notify={setMessage} />,
    commerce: <CommercePanel notify={setMessage} />,
    analytics: <AnalyticsPanel />,
    products: <ProductsEditor notify={setMessage} />,
    orders: <OrdersPanel notify={setMessage} />,
    content: <ContentEditor notify={setMessage} />,
    footer: <ContentEditor section="footer" notify={setMessage} />,
    integrations: (
      <IntegrationsPanel
        notify={setMessage}
        defaultPassword={session?.defaultPassword}
      />
    ),
  };
  return localizeView(
    <UploadContext.Provider value={[uploadCount, setUploadCount]}>
      <div
        className={`admin-scope admin-dashboard min-h-screen ${isForm ? "form-admin" : "atelier-admin"} ${navOpen ? "nav-open" : ""}`}
      >
        <Helmet>
          <title>Admin - {store.name}</title>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
        {!scope && store._workspaceUrl && (
          <a className="v-panel" href={store._workspaceUrl}>
            {copy("Open your unified workspace", "افتح مساحة متاجرك الموحدة")} ↗
          </a>
        )}
        {checking ? (
          <Busy />
        ) : !session ? (
          <AdminLogin
            store={store}
            password={password}
            setPassword={setPassword}
            busy={busy}
            error={error}
            onSubmit={login}
          />
        ) : (
          <div className="admin-layout">
            <header
              ref={headerRef}
              onFocusCapture={reveal}
              className={`dashboard-header ${hidden ? "is-scroll-hidden" : ""}`}
            >
              <button
                className="admin-mobile-menu"
                aria-expanded={navOpen}
                onClick={() => setNavOpen(!navOpen)}
              >
                {copy("Sections", "الأقسام")} ☰
              </button>
              <div className="admin-header-row flex items-center justify-between gap-4">
                <div>
                  <Link
                    to="/"
                    className="dashboard-store-name"
                    style={{
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {store.name}
                  </Link>
                  <p className="text-[10px] uppercase tracking-[.18em] text-muted-foreground mt-1">
                    Store management
                  </p>
                </div>
                <div className="admin-header-actions flex gap-2 items-center flex-wrap">
                  <button
                    className="dashboard-language"
                    aria-label={
                      language === "ar"
                        ? "Switch to English"
                        : "التبديل إلى العربية"
                    }
                    onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
                  >
                    <Globe size={15} />
                    {language === "ar" ? "English" : "العربية"}
                  </button>
                  {!scope && (
                    <Button asChild variant="outline" size="sm">
                      <Link to="/" target="_blank">
                        View store <ArrowUpRight size={14} className="ml-2" />
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={uploadCount > 0}
                    onClick={() => {
                      if (canLeave()) logout();
                    }}
                    aria-label="Sign out"
                  >
                    <LogOut size={17} />
                  </Button>
                </div>
              </div>
            </header>
            {navOpen && (
              <button
                className="admin-nav-backdrop"
                aria-label={copy("Close navigation", "إغلاق القائمة")}
                onClick={() => setNavOpen(false)}
              />
            )}
            <aside
              ref={navRef}
              className="dashboard-sidebar"
              role={navOpen ? "dialog" : undefined}
              aria-modal={navOpen ? true : undefined}
              aria-label={copy("Store sections", "أقسام المتجر")}
            >
              <button
                className="admin-mobile-menu"
                onClick={() => setNavOpen(false)}
              >
                {copy("Close", "إغلاق")} ×
              </button>
              <Link to="/admin" className="dashboard-signature">
                <span
                  className="signature-mark"
                  dir="ltr"
                  lang="en"
                  aria-hidden="true"
                >
                  V
                </span>
                <span>
                  {store.name}
                  <small>THE MERCHANT STUDIO</small>
                </span>
              </Link>
              <p className="sidebar-label">
                {copy("WORKSPACE", "مساحة المتجر")}
              </p>
              <nav className="admin-tabs" aria-label="Dashboard sections">
                {availableTabs
                  .filter(([id]) => id !== "brand" || isForm)
                  .map(([id, label, Icon]) => (
                  <button
                    key={id}
                    disabled={uploadCount > 0}
                    onClick={() => {
                      if (!canLeave()) return;
                      reveal();
                      setNavOpen(false);
                      setParams({
                        tab: id,
                      });
                      setError("");
                      setMessage("");
                    }}
                    className={`admin-tab ${tab === id ? "active" : ""}`}
                    aria-current={tab === id ? "page" : undefined}
                  >
                    <Icon size={16} />
                    {{
                      preview: copy("Preview", "معاينة"),
                      imports: copy("Import history", "سجل النقل"),
                      finance: copy("Financial settings", "الإعدادات المالية"),
                      collections: copy("Collections", "المجموعات"),
                      messages: copy("Messages", "الرسائل"),
                      newsletter: copy("Newsletter", "النشرة البريدية"),
                      design: copy("Store design", "تصميم المتجر"),
                      customers: copy("Customers", "العملاء"),
                      reviews: copy("Reviews", "التقييمات"),
                      returns: copy(
                        "Returns & exchanges",
                        "الاسترجاع والاستبدال",
                      ),
                      payments: copy("Payments", "المدفوعات"),
                    }[id] || label}
                  </button>
                  ))}
              </nav>
              <div className="sidebar-bottom">
                <span
                  className={`store-status-dot ${store.commerce?.acceptingOrders === false ? "paused" : ""}`}
                />
                <div>
                  {store.commerce?.acceptingOrders === false
                    ? "Orders paused"
                    : "Your store is open"}
                  <small>Independent by design.</small>
                </div>
              </div>
            </aside>
            <main className="dashboard-main">
              <div className="studio-page-heading">
                <div>
                  <span className="studio-template-badge">
                    {isForm ? "FORM" : "THE ATELIER"} ·{" "}
                    {copy("MERCHANT STUDIO", "لوحة المتجر")}
                  </span>
                  <h1>
                    {copy(
                      availableTabs.find(([id]) => id === tab)?.[1] ||
                        "Overview",
                      {
                        preview: "معاينة",
                        imports: "سجل النقل",
                        finance: "الإعدادات المالية",
                        collections: "المجموعات",
                        messages: "الرسائل",
                        newsletter: "النشرة البريدية",
                        overview: "نظرة عامة",
                        orders: "الطلبات",
                        products: "المنتجات",
                        brand: "هوية المتجر",
                        commerce: "إعدادات التجارة",
                        content: "محتوى المتجر",
                        footer: "الفوتر والإعدادات",
                        analytics: "التحليلات",
                        integrations: "التكاملات",
                        design: "تصميم المتجر",
                        customers: "العملاء",
                        reviews: "التقييمات",
                        returns: "الاسترجاع والاستبدال",
                        payments: "المدفوعات",
                      }[tab],
                    )}
                  </h1>
                </div>
                <Link
                  to="/admin?tab=design"
                  className="studio-heading-action"
                >
                  {copy("Customize store", "تخصيص المتجر")}
                  <ArrowUpRight size={16} />
                </Link>
              </div>
              {error && <Notice error>{error}</Notice>}
              {message && <Notice>{message}</Notice>}
              <motion.div
                key={tab}
                initial={{
                  opacity: 0,
                  y: 10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.25,
                }}
              >
                {content[tab]}
              </motion.div>
              <p className="text-center text-[10px] text-muted-foreground mt-12 mb-4">
                {store.name} · Thoughtfully made, thoughtfully managed.
              </p>
            </main>
          </div>
        )}
      </div>
    </UploadContext.Provider>,
    t,
  );
}
