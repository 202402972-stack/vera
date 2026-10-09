import { useStoreApi, Link } from "@/workspace/StoreScope";
import React, { useEffect, useState } from "react";

import {
  ArrowUpRight,
  Package,
  ShoppingBag,
  Layers,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/api/store";
import { useStore } from "@/hooks/useStore";
import { useLanguage } from "@/i18n/LanguageContext";
export default function GalaOverview() {
  const api = useStoreApi();
  const { store } = useStore(),
    { language, date } = useLanguage(),
    t = (en, ar) => (language === "ar" ? ar : en);
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () =>
      api("/admin/operations")
        .then((d) => {
          if (active) {
            setData(d);
            setError("");
          }
        })
        .catch((e) => active && setError(e.message));
    load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [api]);
  return (
    <div className="gs-overview">
      <section className="gs-overview-hero">
        <div>
          <span className="gs-eyebrow">
            {t("YOUR BUSINESS, CONSIDERED", "متجرك، بكل تفاصيله")}
          </span>
          <h2>
            {t("A new day.", "يوم جديد.")}
            <br />
            {t("Every detail in view.", "وكل التفاصيل أمامك.")}
          </h2>
          <p>
            {t(
              "Your collection, your customers, and everything that comes next.",
              "منتجاتك، وعملاؤك، وكل ما يحتاج إلى اهتمامك.",
            )}
          </p>
          <Link to="/admin?tab=products">
            {t("Manage your collection", "إدارة منتجاتك")}{" "}
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="gs-overview-mark" aria-hidden="true">
          G
        </div>
        <span className="gs-overview-date">
          {date(new Date(), { dateStyle: "long" })}
        </span>
      </section>
      {error && (
        <p className="gs-error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <p role="status">
          {t("Loading your store activity…", "جارٍ تحميل نشاط المتجر…")}
        </p>
      ) : (
        <>
          <div className="gs-kpis">
            {[
              [
                Package,
                data.published,
                t("Published products", "المنتجات المنشورة"),
                "products",
              ],
              [
                ShoppingBag,
                data.pendingOrders,
                t("Orders to prepare", "طلبات تحتاج تجهيزًا"),
                "orders",
              ],
              [
                AlertCircle,
                data.lowStock.length + (data.lowStock.length === 12 ? "+" : ""),
                t("Styles running low", "خيارات مخزونها منخفض"),
                "products",
              ],
              [
                Layers,
                data.drafts,
                t("Draft products", "مسودات المنتجات"),
                "products",
              ],
            ].map(([Icon, value, label, tab]) => (
              <Link to={"/admin?tab=" + tab} key={label}>
                <Icon size={18} />
                <strong>{value}</strong>
                <span>{label}</span>
                <ArrowUpRight size={13} />
              </Link>
            ))}
          </div>
          <div className="gs-overview-columns">
            <section className="gs-overview-panel">
              <div className="gs-panel-head">
                <h3>{t("Latest orders", "أحدث الطلبات")}</h3>
                <Link to="/admin?tab=orders">
                  {t("View all", "عرض الكل")} ↗
                </Link>
              </div>
              {data.recentOrders.length ? (
                data.recentOrders.map((o) => (
                  <Link
                    className="gs-order-row"
                    key={o.id}
                    to={"/admin?tab=orders&order=" + o.id}
                  >
                    <span>{o.customer.name.slice(0, 1)}</span>
                    <div>
                      <b>{o.customer.name}</b>
                      <small>
                        {o.number} ·{" "}
                        {date(o.created_at, { month: "short", day: "numeric" })}
                      </small>
                    </div>
                    <strong>
                      {formatCurrency(o.total_in_cents, { symbol: o.symbol })}
                    </strong>
                    <em>
                      {t(
                        o.status,
                        {
                          new: "جديد",
                          processing: "قيد التجهيز",
                          shipped: "تم الشحن",
                          delivered: "تم التسليم",
                          cancelled: "ملغي",
                        }[o.status] || o.status,
                      )}
                    </em>
                  </Link>
                ))
              ) : (
                <div className="gs-empty">
                  <ShoppingBag size={28} />
                  <h4>
                    {t(
                      "Your next chapter starts here.",
                      "أول طلب هو بداية الحكاية.",
                    )}
                  </h4>
                  <p>
                    {t(
                      "Orders appear here as customers discover your collection.",
                      "ستظهر الطلبات هنا عندما يتعرف العملاء على منتجاتك.",
                    )}
                  </p>
                  <Link to="/admin?tab=products">
                    {t("Manage products", "إدارة المنتجات")} ↗
                  </Link>
                </div>
              )}
            </section>
            <section className="gs-overview-panel">
              <div className="gs-panel-head">
                <h3>{t("Inventory watch", "متابعة المخزون")}</h3>
                <Link to="/admin?tab=products">{t("Manage", "إدارة")} ↗</Link>
              </div>
              {data.lowStock.length ? (
                data.lowStock.slice(0, 6).map((v, i) => (
                  <Link
                    className="gs-inventory-row"
                    key={i}
                    to={"/admin?tab=products&product=" + v.product_id}
                  >
                    <div>
                      <b>
                        {language === "ar" ? v.title_ar || v.title : v.title}
                      </b>
                      <small>
                        {language === "ar"
                          ? v.variant_ar || v.variant
                          : v.variant}
                      </small>
                    </div>
                    <span>
                      {v.quantity} {t("left", "متبقي")}
                    </span>
                  </Link>
                ))
              ) : (
                <div className="gs-empty">
                  <Package size={28} />
                  <h4>{t("Your collection is ready.", "منتجاتك جاهزة.")}</h4>
                  <p>
                    {t(
                      "Published styles are above your low-stock alert threshold.",
                      "مخزون الخيارات المنشورة أعلى من حد التنبيه المحدد.",
                    )}
                  </p>
                </div>
              )}
            </section>
          </div>
          <section className="gs-overview-design">
            <img src={store.gala.hero.images[0]} alt="" />
            <div>
              <span className="gs-eyebrow">GALA / DESIGN STUDIO</span>
              <h3>{t("Make it unmistakably yours.", "اجعله يعبر عنك.")}</h3>
              <p>
                {t(
                  "Shape the collage, curate the collection, and make every page feel like your brand.",
                  "خصص صور الواجهة والمجموعات وكل صفحة لتناسب هوية علامتك.",
                )}
              </p>
              <Link className="gs-primary" to="/admin?tab=design">
                {t("Open design studio", "فتح استوديو التصميم")}{" "}
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </section>
          {data.telegramFailures > 0 && (
            <Link className="gs-error" to="/admin?tab=integrations">
              {t(
                "Notification delivery needs attention: ",
                "إرسال الإشعارات يحتاج مراجعة: ",
              )}
              {data.telegramFailures} ↗
            </Link>
          )}
        </>
      )}
    </div>
  );
}
