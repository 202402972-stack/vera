import { useStoreApi, Link } from "@/workspace/StoreScope";
import { useEffect, useState } from "react";

import {
  ArrowUpRight,
  Package,
  ShoppingBag,
  Palette,
  AlertTriangle,
  Check,
  ArrowRight,
} from "lucide-react";
import { formatCurrency } from "@/api/store";
import { useStore } from "@/hooks/useStore";
import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import { Panel, Notice, Busy } from "./AdminUI";
import AnalyticsPanel from "./AnalyticsPanel";

export default function OperationsPanel() {
  const api = useStoreApi();
  const { t, language, date } = useLanguage();
  const { store } = useStore();
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const reload = () =>
      api("/admin/operations")
        .then((d) => {
          if (live) {
            setData(d);
            setError("");
          }
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    reload();
    const timer = setInterval(reload, 30000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [api]);
  if (!data) return error ? <Notice error>{error}</Notice> : <Busy />;
  const tasks = [
    [
      data.pendingOrders === 0,
      "Orders to prepare",
      `${data.pendingOrders}`,
      "orders",
    ],
    [
      data.lowStock.length === 0,
      "Styles running low",
      `${data.lowStock.length}${data.lowStock.length === 12 ? "+" : ""}`,
      "products",
    ],
    [
      data.telegramFailures === 0,
      "Notification issues",
      `${data.telegramFailures}`,
      "integrations",
    ],
  ];
  return localizeView(
    <div className="space-y-7">
      <section className="operations-welcome">
        <div>
          <p className="admin-section-label">
            {store._template?.renderer === "form"
              ? language === "ar"
                ? "متجرك، بنظرة واضحة"
                : "YOUR STORE, IN FOCUS"
              : "YOUR BOUTIQUE, IN FOCUS"}
          </p>
          <h1>
            A clear view.
            <br />A considered next step.
          </h1>
          <p>
            Everything you need to care for your brand, your collection and your
            customers.
          </p>
          <Link to="/admin?tab=products" className="welcome-link">
            Manage your collection <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="welcome-emblem" aria-hidden="true">
          <span dir="ltr" lang="en">
            {store._template?.renderer === "form" ? "V" : "B"}
          </span>
          <i />
          <i />
        </div>
        <span className="welcome-date">
          {date(new Date(), { dateStyle: "long" })}
        </span>
      </section>
      {error && <Notice error>{error}</Notice>}
      <div className="operations-tasks">
        {tasks.map(([ok, label, value, tab]) => (
          <Link
            key={tab}
            to={`/admin?tab=${tab}`}
            className={`operation-task ${ok ? "is-clear" : ""}`}
          >
            <span className="task-icon">
              {ok ? <Check size={18} /> : <AlertTriangle size={18} />}
            </span>
            <div>
              <span>{t(label)}</span>
              <strong>{value}</strong>
            </div>
            <ArrowUpRight size={17} />
          </Link>
        ))}
      </div>
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
        <Panel
          title="Latest orders"
          subtitle="Real orders, ready for your attention."
          icon={ShoppingBag}
          action={
            <Link className="panel-text-link" to="/admin?tab=orders">
              View all <ArrowUpRight size={14} />
            </Link>
          }
        >
          {!data.recentOrders.length ? (
            <div className="thoughtful-empty">
              <ShoppingBag size={30} />
              <h3>Your next chapter starts here.</h3>
              <p>
                New orders will appear as customers discover your collection.
              </p>
              <Link to="/" target="_blank" rel="noreferrer">
                Visit your store <ArrowUpRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="recent-orders">
              {data.recentOrders.map((o) => (
                <Link to={`/admin?tab=orders&order=${o.id}`} key={o.id}>
                  <span className="order-initial">
                    {o.customer.name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{o.customer.name}</strong>
                    <small>
                      {o.number} ·{" "}
                      {date(o.created_at, { month: "short", day: "numeric" })}
                    </small>
                  </span>
                  <span className={`admin-status ${o.status}`}>
                    {t(o.status)}
                  </span>
                  <b>
                    {formatCurrency(o.total_in_cents, { symbol: o.symbol })}
                  </b>
                </Link>
              ))}
            </div>
          )}
        </Panel>
        <Panel
          title="Inventory watch"
          subtitle="Published styles at or below your alert threshold."
          icon={Package}
        >
          {!data.lowStock.length ? (
            <div className="thoughtful-empty">
              <Check size={28} />
              <h3>Room to grow.</h3>
              <p>Your published styles are above the low-stock threshold.</p>
            </div>
          ) : (
            <div className="inventory-watch">
              {data.lowStock.slice(0, 5).map((v, i) => (
                <Link
                  key={i}
                  to={`/admin?tab=products&product=${encodeURIComponent(v.product_id)}`}
                >
                  <div>
                    <strong>
                      {language === "ar" ? v.title_ar || v.title : v.title}
                    </strong>
                    <small>
                      {language === "ar"
                        ? v.variant_ar || v.variant
                        : v.variant}
                    </small>
                  </div>
                  <span
                    className={v.quantity === 0 ? "stock-out" : "stock-low"}
                  >
                    {v.quantity === 0
                      ? t("Out of stock")
                      : `${v.quantity} ${t("left")}`}
                  </span>
                </Link>
              ))}
            </div>
          )}
          <div className="inventory-summary">
            <span>
              {data.published} {t("published")}
            </span>
            <span>
              {data.drafts} {t("drafts")}
            </span>
          </div>
        </Panel>
      </div>
      <Link to="/admin?tab=brand" className="brand-callout">
        <span className="callout-icon">
          <Palette size={22} />
        </span>
        <div>
          <h3>Make every detail yours.</h3>
          <p>Explore your palette, wordmark and storefront in Brand studio.</p>
        </div>
        <ArrowRight size={20} />
      </Link>
      <AnalyticsPanel compact />
    </div>,
    t,
  );
}
