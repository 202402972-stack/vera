import React, { useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { api, jsonRequest } from "@/api/store";
import { Panel, Notice, Busy } from "./AdminUI";
export default function RetailPanel({ kind, notify }) {
  const { language } = useLanguage(),
    t = (en, ar) => (language === "ar" ? ar : en),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(null);
  const statusLabels = {
    pending: t("Pending", "قيد المراجعة"),
    requested: t("Requested", "قيد المراجعة"),
    approved: t("Approved", "موافق عليه"),
    rejected: t("Rejected", "مرفوض"),
    received: t("Received", "تم الاستلام"),
    closed: t("Closed", "مغلق"),
  };
  const reload = useCallback(
    () =>
      api("/admin/" + kind)
        .then((d) => setData(d[kind]))
        .catch((e) => setError(e.message)),
    [kind],
  );
  useEffect(() => {
    setData(null);
    reload();
  }, [reload]);
  async function update(id, body) {
    setBusy(true);
    setError("");
    try {
      await api(`/admin/${kind}/${id}`, jsonRequest("PATCH", body));
      await reload();
      notify(t("Changes saved.", "تم حفظ التعديلات."));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const titles = {
    customers: t("Customers", "العملاء"),
    reviews: t("Customer reviews", "تقييمات العملاء"),
    returns: t("Returns & exchanges", "الاسترجاع والاستبدال"),
  };
  return (
    <Panel
      title={titles[kind]}
      subtitle={
        kind === "returns"
          ? t(
              "Review requests, coordinate receipt, and confirm outcomes. Payment refunds must be reconciled separately.",
              "راجع الطلبات ونسّق الاستلام وسجّل النتيجة. استرداد المدفوعات يُراجع بشكل مستقل.",
            )
          : t("Real activity from your store.", "نشاط فعلي من متجرك.")
      }
    >
      {error && <Notice error>{error}</Notice>}
      {recovery && (
        <Notice>
          <p>
            {t(
              "One-time recovery link · expires in 30 minutes. Share only after verifying the customer’s identity.",
              "رابط استعادة يستخدم مرة واحدة وينتهي خلال ٣٠ دقيقة. شاركه فقط بعد التحقق من هوية العميل.",
            )}
          </p>
          <input
            aria-label={t("Recovery link", "رابط الاستعادة")}
            readOnly
            value={window.location.origin + recovery}
            dir="ltr"
            className="w-full border p-2 mt-3"
          />
          <button type="button" onClick={() => setRecovery(null)}>
            {t("Dismiss", "إغلاق")}
          </button>
        </Notice>
      )}
      {!data ? (
        <Busy />
      ) : !data.length ? (
        <div className="studio-empty">
          <h3>{t("Nothing to review yet", "لا توجد بيانات بعد")}</h3>
          <p>
            {t(
              "New customer activity will appear here.",
              "سيظهر نشاط العملاء الجديد هنا.",
            )}
          </p>
        </div>
      ) : (
        <div className="studio-retail-list">
          {data.map((row) => (
            <article key={row.id}>
              <div>
                <strong>{row.name || row.email || row.number}</strong>
                <small>
                  {row.email || row.number || row.product_id} ·{" "}
                  {new Date(row.created).toLocaleDateString()}
                </small>
                {kind === "customers" ? (
                  <p>
                    {row.orders} {t("orders", "طلب")}
                  </p>
                ) : (
                  <>
                    <p>
                      {kind === "reviews"
                        ? `${row.rating}/5 · ${row.body}`
                        : row.reason}
                    </p>
                    <span className="studio-status">
                      {statusLabels[row.status] || row.status}
                    </span>
                  </>
                )}
              </div>
              {kind === "customers" && (
                <button
                  className="admin-upload-button"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        t(
                          "Have you verified this customer’s identity through your support process?",
                          "هل تحققت من هوية العميل عبر إجراء الدعم الخاص بك؟",
                        ),
                      )
                    )
                      return;
                    setBusy(true);
                    try {
                      const result = await api(
                        `/admin/customers/${row.id}/recovery`,
                        jsonRequest("POST", {}),
                      );
                      setRecovery(result.url);
                    } catch (e) {
                      setError(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t("Create recovery link", "إنشاء رابط استعادة")}
                </button>
              )}
              {kind === "reviews" && (
                <div className="flex gap-2">
                  <button
                    className="admin-upload-button"
                    disabled={busy}
                    onClick={() => update(row.id, { status: "approved" })}
                  >
                    {t("Approve", "نشر")}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => update(row.id, { status: "rejected" })}
                  >
                    {t("Reject", "رفض")}
                  </button>
                </div>
              )}
              {kind === "returns" && (
                <form
                  className="grid gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const body = Object.fromEntries(
                      new FormData(e.currentTarget),
                    );
                    update(row.id, body);
                  }}
                >
                  <select
                    aria-label={t("Request status", "حالة الطلب")}
                    name="status"
                    defaultValue={row.status}
                  >
                    {[
                      "requested",
                      "approved",
                      "rejected",
                      "received",
                      "closed",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {statusLabels[s] || s}
                      </option>
                    ))}
                  </select>
                  <textarea
                    aria-label={t("Message to customer", "رسالة للعميل")}
                    name="note"
                    placeholder={t(
                      "Next steps for the customer",
                      "الخطوات التالية للعميل",
                    )}
                    defaultValue={row.note}
                    maxLength={2000}
                  />
                  <button className="admin-upload-button" disabled={busy}>
                    {t("Save response", "حفظ الرد")}
                  </button>
                </form>
              )}
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}
