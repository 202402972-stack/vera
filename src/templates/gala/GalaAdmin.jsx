import { useDialog } from "./context";
import "@/workspace/workspace.css";
import { StorePreview, StoreImports } from "@/workspace/StoreTools";
import FinancialSettings from "@/components/admin/FinancialSettings";
import DesignPreview from "@/components/admin/DesignPreview";
import {
  useStoreApi,
  useStoreUrl,
  Link,
  useAdminNavigation,
  useStoreScope,
} from "@/workspace/StoreScope";
import GalaContent from "./GalaContent";
import { StructuredField } from "./StructuredField";
import React, { useEffect, useState, useCallback, useRef } from "react";

import { Helmet } from "react-helmet";
import {
  ArrowUpRight,
  PanelLeft,
  LogOut,
  Save,
  Palette,
  Package,
  ShoppingBag,
  Users,
  LayoutDashboard,
  MessageSquare,
  Mail,
  Settings,
  ChartNoAxesCombined,
  Star,
  RotateCcw,
  CreditCard,
  Plug,
  Layers,
  Type,
} from "lucide-react";
import { jsonRequest } from "@/api/store";
import { useStore } from "@/hooks/useStore";
import { useLanguage, localizeView } from "@/i18n/LanguageContext";

import useSettingsEditor from "@/hooks/useSettingsEditor";
import { UploadContext } from "@/components/admin/UploadContext";
import GalaOverview from "./GalaOverview";
import ProductsEditor from "@/components/admin/ProductsEditor";
import CollectionsPanel from "@/components/admin/CollectionsPanel";
import OrdersPanel from "@/components/admin/OrdersPanel";
import RetailPanel from "@/components/admin/RetailPanel";
import PaymentsPanel from "@/components/admin/PaymentsPanel";
import CommercePanel from "@/components/admin/CommercePanel";
import AnalyticsPanel from "@/components/admin/AnalyticsPanel";
import IntegrationsPanel from "@/components/admin/IntegrationsPanel";
import "@/admin.css";
import "./studio.css";
const names = {
  palette: ["Colour system", "نظام الألوان"],
  typography: ["Typography", "الخطوط"],
  layout: ["Layout & spacing", "التخطيط والمسافات"],
  navigation: ["Main navigation", "القائمة الرئيسية"],
  mobileNavigation: ["Mobile navigation", "تنقل الموبايل"],
  hero: ["Hero collage", "صور الواجهة"],
  sections: ["Homepage order", "ترتيب الصفحة الرئيسية"],
  headings: ["Section headings", "عناوين الأقسام"],
  trendingIds: ["Trending products", "المنتجات الرائجة"],
  lookbookIds: ["Shop the look", "منتجات الإطلالة"],
  collectionIds: ["Featured collections", "المجموعات المختارة"],
  storyImage: ["Story image", "صورة الحكاية"],
  storyButton: ["Story button", "زر الحكاية"],
  testimonials: ["Editorial testimonials", "آراء العملاء المختارة"],
  services: ["Service promises", "مزايا الخدمة"],
  faq: ["Homepage FAQ", "أسئلة الصفحة الرئيسية"],
  productFaq: ["Product FAQ", "أسئلة المنتج"],
  product: ["Product experience", "خصائص صفحة المنتج"],
  cart: ["Cart experience", "خصائص السلة"],
  newsletter: ["Newsletter", "النشرة البريدية"],
  footerColumns: ["Footer links", "روابط الفوتر"],
  currency: ["Display currencies", "عملات العرض"],
};
function Design({ notify }) {
  const api = useStoreApi();
  const { value, setValue, error, setError, busy, dirty, save } =
      useSettingsEditor(notify),
    { language } = useLanguage();
  const copy = (en, ar) => (language === "ar" ? ar : en);
  const [active, setActive] = useState("hero"),
    [view, setView] = useState("edit"),
    [options, setOptions] = useState({ products: [], collections: [] });
  useEffect(() => {
    Promise.all([api("/admin/products?limit=100"), api("/collections")])
      .then(([p, c]) =>
        setOptions({ products: p.products, collections: c.collections }),
      )
      .catch((e) => setError(e.message));
  }, [api, setError]);
  if (!value)
    return (
      <p role={error ? "alert" : "status"}>
        {error || copy("Loading studio…", "جارٍ تحميل المحرر…")}
      </p>
    );
  const cfg = value.gala;
  return (
    <form
      className="gs-design"
      data-dirty={dirty}
      onSubmit={async (e) => {
        await save(e);
      }}
    >
      <div className="gs-design-bar">
        <div>
          <h2>{copy("Design your GALA", "صمّم GALA على ذوقك")}</h2>
          <p>
            {copy(
              "Changes appear in the storefront after publishing.",
              "تظهر التعديلات في المتجر بعد الحفظ والنشر.",
            )}
          </p>
        </div>
        <button className="gs-primary" disabled={busy || !dirty}>
          <Save size={16} />
          {busy
            ? copy("Saving…", "جارٍ الحفظ…")
            : copy("Save changes", "حفظ التعديلات")}
        </button>
      </div>
      {error && (
        <p className="gs-error" role="alert">
          {error}
        </p>
      )}
      <div className="gs-view-tabs">
        <button type="button" onClick={() => setView("edit")}>
          {copy("Edit", "تحرير")}
        </button>
        <button type="button" onClick={() => setView("preview")}>
          {copy("Preview", "معاينة")}
        </button>
        <select
          aria-label={copy("Setting group", "مجموعة الإعدادات")}
          value={active}
          onChange={(e) => setActive(e.target.value)}
        >
          {Object.keys(names).map((k) => (
            <option key={k} value={k}>
              {names[k][language === "ar" ? 1 : 0]}
            </option>
          ))}
        </select>
      </div>
      <div className={"gs-design-layout view-" + view}>
        <nav className="gs-design-nav">
          {Object.keys(names).map((k) => (
            <button
              type="button"
              aria-current={active === k ? "page" : undefined}
              key={k}
              onClick={() => setActive(k)}
            >
              {names[k][language === "ar" ? 1 : 0]}
            </button>
          ))}
        </nav>
        <div className="gs-inspector" key={active}>
          <StructuredField
            value={cfg[active]}
            label={names[active][language === "ar" ? 1 : 0]}
            path={active}
            options={options}
            onError={setError}
            onChange={(v) =>
              setValue({ ...value, gala: { ...cfg, [active]: v } })
            }
          />
          {active === "testimonials" && (
            <p className="gs-hint">
              {copy(
                "Only publish feedback you have permission to feature. Verified product reviews are managed under Reviews.",
                "انشر آراء حقيقية لديك إذن بعرضها. تقييمات المنتجات الموثّقة تُدار من قسم التقييمات.",
              )}
            </p>
          )}
        </div>
        <div className="gs-preview">
          <DesignPreview value={value} onError={setError} />
        </div>
      </div>
    </form>
  );
}
export function Inbox({ kind, notify }) {
  const api = useStoreApi();
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const { language } = useLanguage(),
    t = (en, ar) => (language === "ar" ? ar : en);
  const load = useCallback(
    () =>
      api("/admin/" + kind)
        .then(setData)
        .catch((e) => setError(e.message)),
    [api, kind],
  );
  useEffect(() => {
    setData(null);
    load();
  }, [load]);
  const rows = data?.[kind === "newsletter" ? "subscribers" : "messages"] || [];
  return (
    <div className="gs-inbox">
      <h2>
        {kind === "newsletter"
          ? t("Newsletter subscribers", "مشتركو النشرة البريدية")
          : t("Customer messages", "رسائل العملاء")}
      </h2>
      {error && <p role="alert">{error}</p>}
      {!data ? (
        <p>{t("Loading…", "جارٍ التحميل…")}</p>
      ) : !rows.length ? (
        <div className="gs-empty">
          {t(
            "Nothing here yet. New activity will appear here.",
            "لا توجد بيانات بعد. ستظهر الأنشطة الجديدة هنا.",
          )}
        </div>
      ) : (
        rows.map((r, i) => (
          <article key={r.id || r.email}>
            <div>
              <b>{r.name || r.email}</b>
              <small>{r.created || r.created_at}</small>
            </div>
            {r.body && (
              <>
                <a href={"mailto:" + r.email}>{r.email}</a>
                <p>{r.body}</p>
              </>
            )}
            <button
              type="button"
              onClick={async () => {
                try {
                  if (kind === "newsletter") {
                    await api(
                      "/admin/newsletter",
                      jsonRequest("DELETE", { email: r.email }),
                    );
                    notify(t("Subscriber removed.", "تم حذف الاشتراك."));
                  } else
                    await api(
                      "/admin/messages/" + r.id,
                      jsonRequest("PATCH", {
                        status: r.status === "new" ? "resolved" : "new",
                      }),
                    );
                  await load();
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              {kind === "newsletter"
                ? t("Remove subscriber", "حذف الاشتراك")
                : r.status === "new"
                  ? t("Mark resolved", "تم التعامل مع الرسالة")
                  : t("Reopen", "إعادة الفتح")}
            </button>
          </article>
        ))
      )}
    </div>
  );
}
const tabs = [
  ["overview", "Overview", "نظرة عامة", LayoutDashboard],
  ["design", "GALA design studio", "استوديو GALA", Palette],
  ["products", "Products", "المنتجات", Package],
  ["collections", "Collections", "المجموعات", Layers],
  ["orders", "Orders", "الطلبات", ShoppingBag],
  ["customers", "Customers", "العملاء", Users],
  ["reviews", "Reviews", "التقييمات", Star],
  ["returns", "Returns & exchanges", "الاسترجاع والاستبدال", RotateCcw],
  ["messages", "Customer messages", "رسائل العملاء", MessageSquare],
  ["newsletter", "Newsletter", "النشرة البريدية", Mail],
  ["content", "Store copy & policies", "المحتوى والسياسات", Type],
  ["brand", "Brand & announcement", "الهوية والإعلانات", Palette],
  ["footer", "Contact & social", "التواصل والروابط", Settings],
  ["commerce", "Shipping & promotions", "الشحن والعروض", ShoppingBag],
  ["payments", "Payments", "المدفوعات", CreditCard],
  ["analytics", "Analytics", "التحليلات", ChartNoAxesCombined],
  ["integrations", "Connections", "التكاملات", Plug],
  ["preview", "Preview", "معاينة", Palette],
  ["imports", "Import history", "سجل النقل", Package],
  ["finance", "Financial settings", "الإعدادات المالية", CreditCard],
];
export default function GalaAdmin() {
  const api = useStoreApi();
  const scope = useStoreScope();
  const { store, refresh } = useStore(),
    { language, setLanguage, t } = useLanguage();
  const copy = (en, ar) => (language === "ar" ? ar : en);
  const [params, setParams] = useAdminNavigation(),
    [session, setSession] = useState(null),
    [checking, setChecking] = useState(true),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [mobile, setMobile] = useState(false),
    uploads = useState(0);
  const navRef = useRef(null);
  useDialog(mobile, navRef, () => setMobile(false));
  const tab = tabs.find((x) => x[0] === params.get("tab")) || tabs[0];
  useEffect(() => {
    api("/admin/session")
      .then(setSession)
      .catch(() => {})
      .finally(() => setChecking(false));
    const expired = (e) => {
      if ((e.detail?.storeId || null) === (scope?.storeId || null))
        setSession(null);
    };
    window.addEventListener("admin-session-expired", expired);
    return () => window.removeEventListener("admin-session-expired", expired);
  }, [api, scope?.storeId]);
  const notify = (m) => setMessage(m);
  const components = {
    preview: <StorePreview />,
    imports: scope ? <StoreImports /> : null,
    finance: <FinancialSettings notify={notify} />,
    settings: <CommercePanel notify={notify} />,
    overview: <GalaOverview />,
    design: <Design notify={notify} />,
    products: <ProductsEditor notify={notify} />,
    collections: <CollectionsPanel notify={notify} />,
    orders: <OrdersPanel notify={notify} />,
    customers: <RetailPanel kind="customers" notify={notify} />,
    reviews: <RetailPanel kind="reviews" notify={notify} />,
    returns: <RetailPanel kind="returns" notify={notify} />,
    messages: <Inbox kind="messages" notify={notify} />,
    newsletter: <Inbox kind="newsletter" notify={notify} />,
    content: <GalaContent kind="content" notify={notify} />,
    brand: <GalaContent kind="identity" notify={notify} />,
    footer: <GalaContent kind="footer" notify={notify} />,
    commerce: <CommercePanel notify={notify} />,
    payments: <PaymentsPanel notify={notify} />,
    analytics: <AnalyticsPanel />,
    integrations: (
      <IntegrationsPanel
        notify={notify}
        defaultPassword={session?.defaultPassword}
      />
    ),
  };
  return (
    <UploadContext.Provider value={uploads}>
      <div
        className="admin-scope gala-studio"
        dir={language === "ar" ? "rtl" : "ltr"}
      >
        <Helmet>
          <title>GALA Studio · {store.name}</title>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
        {!scope && store._workspaceUrl && (
          <a className="gs-notice" href={store._workspaceUrl}>
            {copy("Open your unified workspace", "افتح مساحة متاجرك الموحدة")} ↗
          </a>
        )}
        {checking ? (
          <div className="gs-empty" role="status">
            {copy("Opening your studio…", "جارٍ فتح الاستوديو…")}
          </div>
        ) : !session ? (
          <div className="gs-login">
            <div>
              <span className="gs-eyebrow">GALA / MERCHANT STUDIO</span>
              <h1>
                {copy(
                  "A considered space for your business.",
                  "مساحة مدروسة لإدارة علامتك.",
                )}
              </h1>
              <p>{store.name}</p>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await api("/admin/login", jsonRequest("POST", { password }));
                  setSession(await api("/admin/session"));
                  setPassword("");
                  await refresh();
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>{copy("Welcome back", "أهلًا بعودتك")}</h2>
              <label>
                {copy("Store password", "كلمة مرور المتجر")}
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              {error && <p role="alert">{error}</p>}
              <button className="gs-primary" disabled={busy}>
                {copy("Enter studio", "الدخول للاستوديو")}{" "}
                <ArrowUpRight size={16} />
              </button>
              <Link to="/">{copy("Back to storefront", "العودة للمتجر")}</Link>
            </form>
          </div>
        ) : (
          <>
            {mobile && (
              <button
                className="admin-nav-backdrop"
                aria-label={copy("Close navigation", "إغلاق القائمة")}
                onClick={() => setMobile(false)}
              />
            )}
            <aside
              ref={navRef}
              role={mobile ? "dialog" : undefined}
              aria-modal={mobile ? true : undefined}
              aria-label={copy("Studio sections", "أقسام الاستوديو")}
              className={"gs-sidebar " + (mobile ? "is-open" : "")}
            >
              {mobile && (
                <button onClick={() => setMobile(false)}>
                  {copy("Close", "إغلاق")} ×
                </button>
              )}
              <Link to="/" className="gs-wordmark">
                GALA<span>MERCHANT STUDIO</span>
              </Link>
              <div className="gs-store-name">
                <span>{store.name.slice(0, 1)}</span>
                <div>
                  {store.name}
                  <small>{copy("Your workspace", "مساحة عملك")}</small>
                </div>
              </div>
              <nav>
                {tabs
                  .filter(
                    ([key]) => scope || !["imports", "preview"].includes(key),
                  )
                  .map(([key, en, ar, Icon]) => (
                    <button
                      key={key}
                      aria-current={tab[0] === key ? "page" : undefined}
                      onClick={() => {
                        if (
                          document.querySelector('[data-dirty="true"]') &&
                          !window.confirm(
                            copy(
                              "Discard unpublished changes?",
                              "تجاهل التعديلات غير المنشورة؟",
                            ),
                          )
                        )
                          return;
                        setParams({ tab: key });
                        setMessage("");
                        setMobile(false);
                      }}
                    >
                      <Icon size={17} />
                      {copy(en, ar)}
                    </button>
                  ))}
              </nav>
              <button
                className="gs-logout"
                onClick={async () => {
                  try {
                    await api("/admin/logout", { method: "POST" });
                    setSession(null);
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                <LogOut size={16} />
                {copy("Sign out", "تسجيل الخروج")}
              </button>
            </aside>
            <div className="gs-workspace">
              <header className="gs-topbar">
                <button
                  className="gs-menu"
                  onClick={() => setMobile(!mobile)}
                  aria-label={copy("Toggle navigation", "فتح القائمة")}
                  aria-expanded={mobile}
                >
                  <PanelLeft size={20} />
                </button>
                <div>
                  <small>GALA / {store.name}</small>
                  <h1>{copy(tab[1], tab[2])}</h1>
                </div>
                <div className="gs-top-actions">
                  <button
                    onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
                  >
                    {language === "ar" ? "English" : "العربية"}
                  </button>
                  <Link to="/" target="_blank">
                    {copy("View store", "معاينة المتجر")}
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              </header>
              <main
                className={
                  tab[0] === "design" ? "gs-main gs-main-design" : "gs-main"
                }
              >
                {message && (
                  <p className="gs-notice" role="status">
                    {message}
                    <button onClick={() => setMessage("")}>×</button>
                  </p>
                )}
                {error && (
                  <p className="gs-error" role="alert">
                    {error}
                  </p>
                )}
                {localizeView(components[tab[0]], t)}
              </main>
            </div>
          </>
        )}
      </div>
    </UploadContext.Provider>
  );
}
