import "@/motion.css";

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  X,
  ShieldCheck,
  Store,
  Pause,
  Play,
  ExternalLink,
  Copy,
  KeyRound,
  Plus,
  CreditCard,
} from "lucide-react";

import "./platform.css";
import { request } from "./api";
import { useCopy, statusLabel, Button, Password } from "./PlatformUI";
const assets = "/platform/assets/";
import Login from "./Login";
const configRoute = (store) => store.workspaceUrl;
function StoreCard({ store, templates, onRefresh, onAction, newWorkspace }) {
  const navigate = useNavigate();
  const template = templates.find((t) => t.id === store.template);
  const t = useCopy();
  const [password, setPassword] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function action(fn) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="v-store-card">
      <div className="v-store-cover">
        <img src={template?.image || assets + "storefront.png"} alt="" />
        <span className={"v-status " + (store.available ? "live" : "")}>
          {store.suspended
            ? t("موقوف إداريًا", "Suspended")
            : store.publicationState === "draft"
              ? t("مسودة", "Draft")
              : store.available
                ? t("متاح", "Live")
                : store.paused
                  ? t("متوقف مؤقتًا", "Paused")
                  : t("يحتاج اشتراكًا", "Subscription needed")}
        </span>
      </div>
      <div className="v-store-body">
        <span className="v-eyebrow">{template?.name}</span>
        <h2>{store.name}</h2>
        <div className="v-store-url">
          <a href={store.url + (store.publicationState === "draft" ? "?preview=1" : "")} target="_blank" rel="noreferrer" dir="ltr">
            {window.location.host}
            {store.url}
          </a>
          <button
            aria-label={t("نسخ الرابط", "Copy link")}
            onClick={() =>
              action(async () => {
                await navigator.clipboard.writeText(
                  window.location.origin + store.url,
                );
                setNotice(t("تم نسخ الرابط", "Link copied"));
              })
            }
          >
            <Copy size={16} />
          </button>
        </div>
        <p className="v-fineprint">
          {t("التجربة حتى: ", "Trial until: ")}
          {new Date(store.trialUntil).toLocaleDateString()} ·{" "}
          {t("الاشتراك: ", "Billing: ")}
          {statusLabel(store.billingStatus, t)}
        </p>
        <p className="v-fineprint">
          {t("تجهيز المتجر", "Store readiness")}:{" "}
          {store.readiness?.percent ?? 0}% · {t("آخر تعديل", "Last updated")}:{" "}
          {new Date(store.updated || store.created).toLocaleString()}
        </p>
        <div className="v-actions">
          <Button
            disabled={busy || store.suspended}
            onClick={() =>
              action(async () => {
                await request(`/stores/${store.id}/admin-entry`, "POST", {});
                if (newWorkspace) navigate(configRoute(store));
                else window.location.assign(store.url + "/admin");
              })
            }
          >
            {t("لوحة المتجر", "Store dashboard")}
            <ArrowUpRight size={16} />
          </Button>
          <a
            className="v-icon-link"
            href={store.url + (store.publicationState === "draft" ? "?preview=1" : "")}
            aria-label={store.publicationState === "draft" ? t("معاينة المسودة", "Preview draft") : t("زيارة المتجر", "Visit store")}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={19} />
          </a>
        </div>
        <div className="v-store-url">
          <Link to={store.workspaceUrl} dir="ltr">
            {store.workspaceUrl}
          </Link>
          <button
            aria-label={t("نسخ رابط الإدارة", "Copy admin link")}
            onClick={() =>
              navigator.clipboard.writeText(
                window.location.origin + store.workspaceUrl,
              )
            }
          >
            <Copy size={16} />
          </button>
        </div>
        <details>
          <summary>{t("إجراءات المتجر", "Store actions")}</summary>
          <div className="v-store-tools">
            <button
              disabled={busy || store.suspended}
              onClick={() =>
                action(async () => {
                  await request("/stores/" + store.id, "PATCH", {
                    paused: !store.paused,
                  });
                  onRefresh();
                })
              }
            >
              {store.paused ? <Play size={15} /> : <Pause size={15} />}{" "}
              {store.paused ? t("تشغيل", "Resume") : t("إيقاف مؤقت", "Pause")}
            </button>
            <button onClick={() => setPassword(!password)}>
              <KeyRound size={15} />
              {t("كلمة المرور", "Password")}
            </button>
            <button onClick={() => onAction(store)}>
              <CreditCard size={15} />
              {t("الاشتراك", "Subscription")}
            </button>
          </div>
        </details>
        {password && (
          <form
            className="v-inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              const p = new FormData(e.currentTarget).get("password");
              action(async () => {
                await request(`/stores/${store.id}/password`, "POST", {
                  password: p,
                });
                setPassword(false);
                setNotice(
                  t(
                    "تم تغيير كلمة المرور وإغلاق جلسات الإدارة السابقة.",
                    "Password changed. Previous dashboard sessions were closed.",
                  ),
                );
              });
            }}
          >
            <Password
              name="password"
              label={t("كلمة مرور الإدارة الجديدة", "New dashboard password")}
            />
            <Button disabled={busy}>
              {t("حفظ كلمة المرور", "Save password")}
            </Button>
          </form>
        )}
        {error && (
          <p className="v-alert" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="v-notice" role="status">
            {notice}
          </p>
        )}
      </div>
    </article>
  );
}
export default function Workspace({ config }) {
  const t = useCopy();
  const navigate = useNavigate();
  const [stores, setStores] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [billing, setBilling] = useState(null),
    [invoices, setInvoices] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("updated");
  const lastStore = localStorage.getItem("vera-last-store");
  useEffect(() => {
    if (!config.user) return;
    let active = true;
    request("/stores")
      .then((r) => {
        if (active) setStores(r.stores);
      })
      .catch((e) => active && setError(e.message));
    request("/invoices")
      .then((r) => active && setInvoices(r.invoices))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [config.user, refresh]);
  if (!config.user) return <Login config={config} />;
  async function billingAction(type, body = {}) {
    setBusy(true);
    setError("");
    try {
      const r = await request(`/stores/${billing.id}/${type}`, "POST", {
        ...body,
        planId: config.plan?.planId,
      });
      if (r.url) window.location.assign(r.url);
      else {
        setBilling(null);
        setRefresh((x) => x + 1);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="v-workspace">
      <div className="v-page-heading">
        <div>
          <span className="v-eyebrow">YOUR SPACE, BEAUTIFULLY ORGANIZED.</span>
          <h1>
            {t("أهلًا، ", "Welcome, ")}
            {config.user.name.split(" ")[0]}.
          </h1>
          <p>
            {t("متاجرك، وخطوتك التالية.", "Your stores. Your next chapter.")}
          </p>
        </div>
        <Button onClick={() => navigate("/workspace/new")}>
          <Plus size={17} />
          {t("متجر جديد", "New store")}
        </Button>
      </div>
      <Link className="v-text-link" to="/workspace/import">
        {t("انقل متجرك", "Import your store")}
      </Link>
      {error && (
        <p className="v-alert" role="alert">
          {error}
        </p>
      )}
      {billing && (
        <section className="v-panel v-billing-panel">
          <button
            className="v-close"
            onClick={() => setBilling(null)}
            aria-label={t("إغلاق", "Close")}
          >
            <X size={20} />
          </button>
          <h2>
            {t("اشتراك ", "Subscription · ")}
            {billing.name}
          </h2>
          {billing.billingPlan && (
            <p>
              {t(
                "خطة التجديد المحفوظة للاشتراك الحالي",
                "Stored renewal plan for the existing subscription",
              )}
              : {billing.billingPlan.currency}{" "}
              {(billing.billingPlan.amount / 100).toFixed(2)} ·{" "}
              {billing.billingPlan.intervalDays
                ? `${billing.billingPlan.intervalDays} ${t("يومًا", "days")}`
                : t("حسب فترة المزوّد", "provider interval")}
            </p>
          )}
          <p>
            {t(
              "إيقاف المتجر مؤقتًا لا يوقف التجديد. يمكنك إلغاء التجديد من هنا.",
              "Pausing your store does not stop renewal. Manage renewal here.",
            )}
          </p>
          {!config.billingReady ? (
            <p className="v-notice">
              {t(
                "الدفع لم يُفعّل بعد. التجربة المجانية متاحة لحسابك.",
                "Payments are not enabled yet. Your account can use its free trial.",
              )}
            </p>
          ) : config.billingProvider === "paymob" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                billingAction(
                  "checkout",
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
              }}
            >
              <p>
                {t("التحصيل الفعلي: ", "Billing total: ")}
                {config.plan &&
                  new Intl.NumberFormat("en", {
                    style: "currency",
                    currency: config.plan.currency,
                  }).format(config.plan.amount / 100)}{" "}
                / {t("٣٠ يومًا", "30 days")}
              </p>
              <div className="v-form-grid">
                <label className="v-field">
                  {t("الاسم الأول", "First name")}
                  <input name="firstName" required maxLength={50} />
                </label>
                <label className="v-field">
                  {t("اسم العائلة", "Last name")}
                  <input name="lastName" required maxLength={50} />
                </label>
                <label className="v-field">
                  {t("رقم الهاتف الدولي", "Phone with country code")}
                  <input
                    name="phone"
                    type="tel"
                    required
                    pattern="\+[0-9]{8,15}"
                    placeholder="+201000000000"
                    dir="ltr"
                  />
                </label>
              </div>
              <label className="v-consent">
                <input type="checkbox" required />
                {t(
                  "أوافق على التجديد التلقائي بالمبلغ المعروض كل ٣٠ يومًا حتى الإلغاء.",
                  "I agree to automatic renewal at the displayed amount every 30 days until cancellation.",
                )}
              </label>
              <div className="v-actions">
                <Button disabled={busy}>
                  {t("الدفع عبر Paymob", "Continue to Paymob")}
                </Button>
                <button
                  type="button"
                  className="v-text-link"
                  disabled={busy}
                  onClick={() => billingAction("cancel-subscription")}
                >
                  {t("إلغاء التجديد", "Cancel renewal")}
                </button>
              </div>
            </form>
          ) : (
            <div className="v-actions">
              <Button disabled={busy} onClick={() => billingAction("checkout")}>
                {t("تفعيل الاشتراك", "Subscribe")}
              </Button>
              <button
                className="v-text-link"
                disabled={busy}
                onClick={() => billingAction("billing")}
              >
                {t("إدارة الفواتير والتجديد", "Manage invoices & renewal")}
              </button>
            </div>
          )}
        </section>
      )}
      {stores === null ? (
        <p className="v-loading">
          {t("جاري تحميل متاجرك…", "Loading your stores…")}
        </p>
      ) : stores.length ? (
        <>
          <div className="v-form-grid">
            <label className="v-field">
              {t("بحث في متاجرك", "Search your stores")}
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="v-field">
              {t("ترتيب المتاجر", "Sort stores")}
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="updated">
                  {t("آخر تعديل", "Last updated")}
                </option>
                <option value="name">{t("الاسم", "Name")}</option>
                <option value="created">
                  {t("الأحدث إنشاءً", "Newest created")}
                </option>
              </select>
            </label>
          </div>
          {stores.some((s) => String(s.id) === lastStore) && (
            <Link
              className="v-text-link"
              to={"/workspace/stores/" + lastStore + "/overview"}
            >
              {t("استكمل آخر متجر", "Resume your last store")}
            </Link>
          )}
          <div className="v-stores">
            {stores
              .filter((s) =>
                (s.name + " " + s.slug + " " + s.template)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .sort((a, b) =>
                sort === "name"
                  ? a.name.localeCompare(b.name)
                  : (b[sort] || b.created) - (a[sort] || a.created),
              )
              .map((store) => (
                <StoreCard
                  templates={config.templates}
                  newWorkspace={config.features?.workspace !== false}
                  key={store.id}
                  store={store}
                  onRefresh={() => setRefresh((x) => x + 1)}
                  onAction={setBilling}
                />
              ))}
          </div>
        </>
      ) : (
        <section className="v-empty">
          <Store strokeWidth={1} />
          <h2>{t("متجرك الأول يبدأ هنا.", "Your first store starts here.")}</h2>
          <p>
            {t(
              "اختر GALA أو أتيليه أو FORM، وأضف التفاصيل التي تجعله لك.",
              "Choose GALA, The Atelier or FORM. Add the details that make it yours.",
            )}
          </p>
          <Button onClick={() => navigate("/workspace/new")}>
            {t("أنشئ أول متجر", "Create your first store")}
          </Button>
        </section>
      )}
      <div className="v-workspace-bottom">
        <section className="v-panel">
          <span className="v-eyebrow">YOUR ACCOUNT</span>
          <h2>{t("حسابك", "Your account")}</h2>
          <p>{config.user.name}</p>
          <p dir="ltr">{config.user.email}</p>
          <span className="v-security">
            <ShieldCheck size={16} />
            {t("متصل بحساب Google", "Connected with Google")}
          </span>
        </section>
        <section className="v-panel">
          <span className="v-eyebrow">BILLING HISTORY</span>
          <h2>{t("سجل المدفوعات", "Payment history")}</h2>
          {invoices.length ? (
            invoices.map((i) => (
              <div className="v-invoice" key={i.id}>
                <span>
                  {i.store}
                  <small>
                    {new Date(i.created).toLocaleDateString()} ·{" "}
                    {statusLabel(i.status, t)}
                  </small>
                </span>
                <strong>
                  {new Intl.NumberFormat("en", {
                    style: "currency",
                    currency: i.currency,
                  }).format(i.amount / 100)}
                </strong>
                {i.url && (
                  <a href={i.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            ))
          ) : (
            <p>{t("لا توجد مدفوعات حتى الآن.", "No payments yet.")}</p>
          )}
        </section>
      </div>
    </main>
  );
}
