import { statusLabel, actionLabel } from "./PlatformUI";
import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { request } from "./api";
import OwnerSettings from "./OwnerSettings";
import "@/workspace/workspace.css";
const sections = {
  overview: ["نظرة عامة", "Overview"],
  merchants: ["التجار", "Merchants"],
  stores: ["المتاجر", "Stores"],
  subscriptions: ["الاشتراكات", "Subscriptions"],
  imports: ["النقل", "Imports"],
  activity: ["النشاط", "Activity"],
  settings: ["الإعدادات", "Settings"],
};
export default function OwnerPortal({ config }) {
  const { section = "overview", merchantId } = useParams(),
    { language } = useLanguage(),
    t = (ar, en) => (language === "ar" ? ar : en),
    [params, setParams] = useSearchParams();
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (section === "settings") return;
    let current = true;
    setData(null);
    setError("");
    request(
      "/owner/" + section + (merchantId ? "/" + merchantId : "?" + params),
    )
      .then((d) => current && setData(d))
      .catch((e) => current && setError(e.message));
    return () => {
      current = false;
    };
  }, [section, merchantId, params, revision]);
  if (!config.user?.isOwner)
    return (
      <main className="v-workspace" role="alert">
        {t("هذه المساحة لمالك المنصة فقط", "Platform owner access required")}
      </main>
    );
  return (
    <main className="v-workspace owner-portal">
      <span className="v-eyebrow">VÉRA / OWNER</span>
      <h1>{sections[section] ? t(...sections[section]) : "VÉRA"}</h1>
      <nav className="owner-navigation">
        {Object.entries(sections).map(([key, label]) => (
          <Link
            key={key}
            to={"/owner/" + key}
            aria-current={key === section ? "page" : undefined}
          >
            {t(...label)}
          </Link>
        ))}
      </nav>
      {section === "settings" ? (
        <OwnerSettings request={request} />
      ) : (
        <>
          {!merchantId && section !== "overview" && (
            <form
              key={section}
              className="v-form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                setParams(Object.fromEntries(new FormData(e.currentTarget)));
              }}
            >
              <label className="v-field">
                {t("بحث", "Search")}
                <input name="q" defaultValue={params.get("q") || ""} />
              </label>
              {section === "merchants" && (
                <label className="v-field">
                  {t(
                    "نشاط التاجر خلال ٣٠ يومًا",
                    "Merchant activity in 30 days",
                  )}
                  <select
                    name="activity"
                    defaultValue={params.get("activity") || ""}
                  >
                    <option value="">{t("الكل", "All")}</option>
                    <option value="active">
                      {t("لديه نشاط مسجل", "Recorded activity")}
                    </option>
                    <option value="inactive">
                      {t(
                        "نشاطه أقدم من ٣٠ يومًا",
                        "Activity older than 30 days",
                      )}
                    </option>
                    <option value="unknown">
                      {t("لا توجد بيانات نشاط", "No activity data")}
                    </option>
                  </select>
                </label>
              )}
              {section === "stores" && (
                <>
                  <label className="v-field">
                    {t("القالب", "Template")}
                    <select
                      name="template"
                      defaultValue={params.get("template") || ""}
                    >
                      <option value="">{t("الكل", "All")}</option>
                      {["gala", "form", "atelier"].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label className="v-field">
                    {t("النشر", "Publication")}
                    <select
                      name="publication"
                      defaultValue={params.get("publication") || ""}
                    >
                      <option value="">{t("الكل", "All")}</option>
                      <option value="draft">{t("مسودة", "Draft")}</option>
                      <option value="published">
                        {t("منشور", "Published")}
                      </option>
                    </select>
                  </label>
                </>
              )}
              {section !== "subscriptions" && (
                <label className="v-field">
                  {t("من تاريخ", "Since")}
                  <input
                    type="date"
                    onChange={(e) => {
                      e.currentTarget.form.elements.since.value = e.target.value
                        ? Date.parse(e.target.value)
                        : "";
                    }}
                  />
                  <input
                    name="since"
                    type="hidden"
                    defaultValue={params.get("since") || ""}
                  />
                </label>
              )}
              {section !== "subscriptions" && (
                <label className="v-field">
                  {t("إلى تاريخ", "Until")}
                  <input
                    type="date"
                    defaultValue={
                      params.get("until")
                        ? new Date(Number(params.get("until")))
                            .toISOString()
                            .slice(0, 10)
                        : ""
                    }
                    onChange={(e) => {
                      e.currentTarget.form.elements.until.value = e.target.value
                        ? Date.parse(e.target.value) + 86399999
                        : "";
                    }}
                  />
                  <input
                    type="hidden"
                    name="until"
                    defaultValue={params.get("until") || ""}
                  />
                </label>
              )}
              {section === "stores" && (
                <>
                  <label className="v-field">
                    {t("حالة الاشتراك", "Billing status")}
                    <select
                      name="billing"
                      defaultValue={params.get("billing") || ""}
                    >
                      <option value="">{t("الكل", "All")}</option>
                      {[
                        "trial",
                        "active",
                        "paid",
                        "failed",
                        "past_due",
                        "canceled",
                      ].map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status, t)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="v-field">
                    {t("الإيقاف الإداري", "Administrative suspension")}
                    <select
                      name="suspended"
                      defaultValue={params.get("suspended") || ""}
                    >
                      <option value="">{t("الكل", "All")}</option>
                      <option value="1">{t("موقوف", "Suspended")}</option>
                      <option value="0">
                        {t("غير موقوف", "Not suspended")}
                      </option>
                    </select>
                  </label>
                </>
              )}
              {section === "imports" && (
                <label className="v-field">
                  {t("الحالة", "State")}
                  <select name="state" defaultValue={params.get("state") || ""}>
                    <option value="">{t("الكل", "All")}</option>
                    {[
                      "queued",
                      "detecting",
                      "scanning",
                      "awaiting_review",
                      "importing",
                      "ready",
                      "partial",
                      "failed",
                      "cancelled",
                    ].map((state) => (
                      <option key={state} value={state}>
                        {statusLabel(state, t)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {section === "subscriptions" && (
                <label className="v-field">
                  {t("حالة الاشتراك", "Subscription status")}
                  <select
                    name="status"
                    defaultValue={params.get("status") || ""}
                  >
                    <option value="">{t("الكل", "All")}</option>
                    {[
                      "active",
                      "trialing",
                      "failed",
                      "past_due",
                      "canceled",
                    ].map((state) => (
                      <option key={state} value={state}>
                        {statusLabel(state, t)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {section === "activity" &&
                [
                  ["actor", t("معرف التاجر", "Merchant ID")],
                  ["store", t("معرف المتجر", "Store ID")],
                  ["action", t("الفعل", "Action")],
                ].map(([key, label]) => (
                  <label className="v-field" key={key}>
                    {label}
                    <input name={key} defaultValue={params.get(key) || ""} />
                  </label>
                ))}
              <button className="v-button">{t("تطبيق", "Apply")}</button>
            </form>
          )}
          {error && (
            <p role="alert" className="v-alert">
              {error}
              <button onClick={() => setRevision((n) => n + 1)}>
                {t("إعادة المحاولة", "Retry")}
              </button>
            </p>
          )}
          {!data && !error && (
            <p role="status">{t("جارٍ التحميل…", "Loading…")}</p>
          )}
          {data?.metrics && (
            <section className="v-panel">
              <p>
                {t("مهام نشطة", "Active jobs")}: {data.metrics.active} ·{" "}
                {t("مساحة القرص الحرة", "Free disk")}:{" "}
                {(data.metrics.freeBytes / 1073741824).toFixed(2)} GB
              </p>
              <p>
                {t("أقدم تقدم لمهمة نشطة", "Oldest active job progress")}:{" "}
                {data.metrics.oldestActive
                  ? new Date(data.metrics.oldestActive).toLocaleString()
                  : t("لا توجد مهمة نشطة", "No active job")}
              </p>
            </section>
          )}
          {data?.counts && (
            <>
              <div className="v-stores-grid">
                {Object.entries(data.counts).map(([k, v]) => (
                  <Link
                    className="v-panel"
                    to={
                      "/owner/" +
                      {
                        newAccounts: "merchants",
                        liveStores: "stores",
                        drafts: "stores?publication=draft",
                        activeSubscriptions: "subscriptions",
                        failedSubscriptions: "subscriptions",
                        importsNeedingReview: "imports",
                      }[k]
                    }
                    key={k}
                  >
                    <strong>{v}</strong>
                    <p>
                      {
                        {
                          newAccounts: t(
                            "حسابات جديدة خلال ٧ أيام",
                            "New accounts in 7 days",
                          ),
                          liveStores: t(
                            "منشور ومتاح",
                            "Published and available",
                          ),
                          drafts: t("مسودات", "Drafts"),
                          activeSubscriptions: t(
                            "اشتراكات فعالة",
                            "Active subscriptions",
                          ),
                          failedSubscriptions: t(
                            "اشتراكات فشلت",
                            "Failed subscriptions",
                          ),
                          importsNeedingReview: t(
                            "نقل يحتاج مراجعة",
                            "Imports needing review",
                          ),
                        }[k]
                      }
                    </p>
                  </Link>
                ))}
              </div>
              <div className="owner-overview-grid">
                <section className="v-panel">
                  <h2>{t("رحلة التجار", "Merchant journey")}</h2>
                  <p>
                    {t("حسابات هذا الأسبوع / السابق", "Accounts this week / previous")}: {data.weeklyGrowth.current} / {data.weeklyGrowth.previous}
                  </p>
                  <p>
                    {t("أكملوا الإعداد خلال ٧ أيام", "Completed setup within 7 days")}: {data.cohort.owners
                      ? `${data.cohort.completed} / ${data.cohort.owners}`
                      : t("لا تتوفر بيانات", "No data available")}
                  </p>
                  <h3>{t("نواقص المسودات", "Draft setup gaps")}</h3>
                  {Object.entries(data.bottlenecks).map(([key, count]) => (
                    <p key={key}>
                      {{
                        identity: t("الهوية", "Identity"),
                        product: t("المنتج", "Product"),
                        shipping: t("الشحن", "Shipping"),
                        payment: t("الدفع", "Payment"),
                        policies: t("السياسات", "Policies"),
                        mobile: t("الموبايل", "Mobile"),
                      }[key]}: {count}
                    </p>
                  ))}
                </section>
                <section className="v-panel">
                  <h2>{t("نقل المنتجات", "Product imports")}</h2>
                  <p>
                    {t("المعتمد من العناصر المختارة", "Imported from selected items")}: {data.importSuccess.selected
                      ? `${data.importSuccess.imported} / ${data.importSuccess.selected}`
                      : t("لا تتوفر بيانات", "No data available")}
                  </p>
                  <Link to="/owner/imports">{t("راجع مهام النقل", "Review import jobs")} ↗</Link>
                </section>
                <section className="v-panel">
                  <h2>{t("دخل الاشتراكات المؤكد", "Confirmed subscription revenue")}</h2>
                  {data.revenue.length ? data.revenue.map((r) => (
                    <p key={r.currency} dir="ltr">{r.currency} {(r.amount / 100).toFixed(2)}</p>
                  )) : <p>{t("لا تتوفر معاملات مؤكدة", "No confirmed transactions available")}</p>}
                  <p>{t("العملات منفصلة؛ المستردات مستبعدة.", "Currencies stay separate; refunds are excluded.")}</p>
                  <Link to="/owner/subscriptions">{t("راجع الاشتراكات", "Review subscriptions")} ↗</Link>
                </section>
              </div>
              <details className="v-panel owner-event-details">
                <summary>{t("تعريف المؤشرات والأحداث", "Metric definitions and events")}</summary>
                <p>{t("الأحداث تبدأ من هذا الإصدار ولا تشمل تاريخًا أقدم. المتجر المتاح منشور، غير متوقف، وله استحقاق صالح.", "Events start with this release. An available store is published, unpaused and has valid entitlement.")}</p>
                {data.events.map((e) => (
                  <p key={e.action}>
                    {{
                      onboarding_started: t("بدأ الإعداد", "Onboarding started"),
                      template_selected: t("اختير قالب", "Template selected"),
                      draft_created: t("أُنشئت مسودة", "Draft created"),
                      import_started: t("بدأ نقل", "Import started"),
                      import_reviewed: t("رُوجع نقل", "Import reviewed"),
                      first_product_ready: t("أول منتج جاهز", "First product ready"),
                      store_published: t("نُشر متجر", "Store published"),
                      first_order: t("أول طلب", "First order"),
                    }[e.action] || e.action}: {e.n}
                  </p>
                ))}
              </details>
            </>
          )}
          {data?.user && (
            <section className="v-panel">
              <h2>{data.user.name}</h2>
              <p>{data.user.email}</p>
              {data.stores.map((s) => (
                <p key={s.id}>
                  {s.name} · {statusLabel(s.publicationState, t)} ·{" "}
                  {statusLabel(s.billingStatus, t)}
                </p>
              ))}
              <p>
                {t(
                  "لا تتوفر سجلات تواصل صادر؛ لا يمكن استنتاج متابعة التاجر.",
                  "No outbound contact history is available; merchant follow-up cannot be inferred.",
                )}
              </p>
              <h3>{t("الاشتراكات والأحداث", "Subscriptions & events")}</h3>
              {data.subscriptions.map((s) => (
                <p key={s.slug}>
                  {s.slug} · {statusLabel(s.billing_status, t)} ·{" "}
                  {new Date(s.access_until).toLocaleDateString()}
                </p>
              ))}
              {data.events.map((e, index) => (
                <p key={index}>
                  {e.action} · {new Date(e.at).toLocaleString()}
                </p>
              ))}
              <h3>{t("النشاط", "Activity")}</h3>
              {data.activity.map((a) => (
                <p key={a.id}>
                  {actionLabel(a.action, t)} · {new Date(a.at).toLocaleString()}
                </p>
              ))}
            </section>
          )}
          {data?.items && (
            <section className="owner-results">
              {data.items.length ? (
                data.items.map((r, i) => (
                  <article className="v-panel" key={r.id || i}>
                    <h2>
                      {r.name || r.store || r.sourceType || r.action || r.id}
                    </h2>
                    {r.email && <p>{r.email}</p>}
                    {section === "merchants" && (
                      <Link to={"/owner/merchants/" + r.id}>
                        {t("تفاصيل التاجر", "Merchant details")} · {r.stores}{" "}
                        {t("متاجر", "stores")}
                      </Link>
                    )}
                    {section === "merchants" && (
                      <p>
                        {t("آخر نشاط مسجل", "Last recorded activity")}:{" "}
                        {r.lastActivity
                          ? new Date(r.lastActivity).toLocaleString()
                          : t("لا تتوفر بيانات", "No data available")}
                      </p>
                    )}
                    {section === "stores" && (
                      <>
                        <p>
                          {statusLabel(r.publicationState, t)} ·{" "}
                          {statusLabel(r.billingStatus, t)} ·{" "}
                          {r.readiness.percent}%
                        </p>
                        <details>
                          <summary>
                            {t(
                              "تفاصيل الجاهزية وتاريخ الحالة",
                              "Readiness details and status history",
                            )}
                          </summary>
                          {r.readiness.checks.map((c) => (
                            <p key={c.id}>
                              {c.ready ? "✓" : "○"}{" "}
                              {
                                {
                                  identity: t("الهوية", "Identity"),
                                  product: t(
                                    "منتج صالح للبيع",
                                    "Sellable product",
                                  ),
                                  shipping: t("الشحن", "Shipping"),
                                  payment: t("الدفع", "Payment"),
                                  policies: t("السياسات", "Policies"),
                                  mobile: t("الموبايل", "Mobile"),
                                }[c.id]
                              }
                            </p>
                          ))}
                          {r.history.map((h, i) => (
                            <p key={i}>
                              {actionLabel(h.action, t)} ·{" "}
                              {new Date(h.at).toLocaleString()}
                            </p>
                          ))}
                        </details>
                        <a href={r.url} target="_blank" rel="noreferrer">
                          {t("زيارة", "Visit")}
                        </a>
                        <button
                          onClick={async () => {
                            const reason = window.prompt(
                              t("سبب الإجراء", "Reason for this action"),
                            );
                            if (!reason) return;
                            try {
                              await request("/owner/stores/" + r.id, "PATCH", {
                                suspended: !r.suspended,
                                reason,
                              });
                              setRevision((n) => n + 1);
                            } catch (e) {
                              setError(e.message);
                            }
                          }}
                        >
                          {r.suspended
                            ? t("استعادة", "Restore")
                            : t("إيقاف", "Suspend")}
                        </button>
                      </>
                    )}
                    {section === "imports" && (
                      <>
                        <p>
                          {statusLabel(r.state, t)} ·{" "}
                          {Object.entries(r.counts)
                            .map(([k, v]) => k + ": " + v)
                            .join(" · ")}{" "}
                          · {r.error} · {r.email} ·{" "}
                          {Math.round(r.durationMs / 1000)}s
                        </p>
                        {["partial", "failed"].includes(r.state) && (
                          <button
                            onClick={async () => {
                              const reason = window.prompt(
                                t("سبب إعادة المحاولة", "Reason for retry"),
                              );
                              if (!reason) return;
                              try {
                                await request(
                                  "/owner/imports/" + r.id + "/retry",
                                  "POST",
                                  { reason },
                                );
                                setRevision((n) => n + 1);
                              } catch (e) {
                                setError(e.message);
                              }
                            }}
                          >
                            {t("أعد العناصر الفاشلة", "Retry failed items")}
                          </button>
                        )}
                      </>
                    )}
                    {section === "subscriptions" && (
                      <>
                        <p>
                          {statusLabel(r.status, t)} ·{" "}
                          {r.amount == null
                            ? t(
                                "لا تتوفر خطة محفوظة",
                                "No stored plan available",
                              )
                            : r.currency +
                              " " +
                              (r.amount / 100).toFixed(2)}{" "}
                          · {r.provider || t("غير معروف", "Unknown")} ·{" "}
                          {r.plan || "—"} · {t("الاستحقاق حتى", "Access until")}
                          : {new Date(r.until).toLocaleDateString()}
                        </p>
                        <details>
                          <summary>
                            {t("كشف المدفوعات", "Payment history")}
                          </summary>
                          {r.payments.length ? (
                            r.payments.map((p) => (
                              <div key={p.id}>
                                <p>
                                  {p.id} · {p.currency}{" "}
                                  {(p.amount / 100).toFixed(2)} ·{" "}
                                  {statusLabel(p.status, t)} ·{" "}
                                  {new Date(p.created).toLocaleString()}
                                </p>
                                <button
                                  disabled={
                                    !config.billingReady ||
                                    config.billingProvider !== "paymob"
                                  }
                                  onClick={async () => {
                                    try {
                                      await request(
                                        "/owner/payments/reconcile",
                                        "POST",
                                        { transactionId: p.id },
                                      );
                                      setRevision((n) => n + 1);
                                    } catch (e) {
                                      setError(e.message);
                                    }
                                  }}
                                >
                                  {t(
                                    "تحقق من المزوّد",
                                    "Reconcile with provider",
                                  )}
                                </button>
                              </div>
                            ))
                          ) : (
                            <p>
                              {t(
                                "لا تتوفر مدفوعات مسجلة",
                                "No recorded payments available",
                              )}
                            </p>
                          )}
                        </details>
                      </>
                    )}
                    {section === "activity" && (
                      <p>
                        {new Date(r.at).toLocaleString()} · {r.detail}
                      </p>
                    )}
                  </article>
                ))
              ) : (
                <p>{t("لا توجد نتائج مطابقة", "No matching results")}</p>
              )}
              <div className="v-actions">
                <button
                  disabled={!data.page}
                  onClick={() =>
                    setParams({
                      ...Object.fromEntries(params),
                      page: data.page - 1,
                    })
                  }
                >
                  {t("السابق", "Previous")}
                </button>
                <span>
                  {data.page + 1} · {data.total}
                </span>
                <button
                  disabled={(data.page + 1) * 25 >= data.total}
                  onClick={() =>
                    setParams({
                      ...Object.fromEntries(params),
                      page: data.page + 1,
                    })
                  }
                >
                  {t("التالي", "Next")}
                </button>
                {section === "merchants" && (
                  <a href={"/api/platform/owner/merchants-export?" + params}>
                    {t(
                      "تصدير النتائج (حتى ١٠٠٠)",
                      "Export results (up to 1000)",
                    )}
                  </a>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
