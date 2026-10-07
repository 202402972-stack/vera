import React, { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
export default function OwnerSettings({ request }) {
  const { language } = useLanguage(),
    t = (ar, en) => (language === "ar" ? ar : en);
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    request("/owner/settings")
      .then(setData)
      .catch((e) => setError(e.message));
  }, [request]);
  return (
    <section className="v-panel">
      <h2>{t("إعدادات المنصة", "Platform settings")}</h2>
      {data && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setSaved(false);
            try {
              await request("/owner/settings", "PATCH", {
                marketingPriceCents: data.marketingPriceCents,
                supportEmail: data.supportEmail,
              });
              setSaved(true);
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="v-form-grid">
            <label className="v-field">
              {t("السعر المعلن بالدولار", "Advertised price in USD")}
              <input
                type="number"
                min="0.01"
                max="1000"
                step="0.01"
                value={data.marketingPriceCents / 100}
                onChange={(e) =>
                  setData({
                    ...data,
                    marketingPriceCents: Math.round(
                      Number(e.target.value) * 100,
                    ),
                  })
                }
                required
              />
              <small>
                {t(
                  "سعر التحصيل الفعلي يُضبط في خطة بوابة الدفع، ولا يتغير من هذا الحقل.",
                  "The actual charge is configured in the payment provider plan, independently of this display price.",
                )}
              </small>
            </label>
            <label className="v-field">
              {t("بريد الدعم", "Support email")}
              <input
                type="email"
                value={data.supportEmail}
                onChange={(e) =>
                  setData({ ...data, supportEmail: e.target.value })
                }
                required
                maxLength={254}
              />
            </label>
          </div>
          <p className="v-fineprint">
            Google:{" "}
            {data.googleReady
              ? t("مُعدّ", "Configured")
              : t("يحتاج إعدادًا", "Setup required")}{" "}
            · {data.billingProvider}:{" "}
            {data.billingReady
              ? t("مُعدّ", "Configured")
              : t("يحتاج إعدادًا", "Setup required")}
          </p>
          <button className="v-button" disabled={busy}>
            {t("حفظ الإعدادات", "Save settings")}
          </button>
          {saved && (
            <p className="v-notice" role="status">
              {t(
                "تم الحفظ. تظهر التغييرات بعد تحديث الصفحة.",
                "Saved. Reload the page to see the changes.",
              )}
            </p>
          )}
        </form>
      )}
      {data?.billingProvider === "Paymob" && (
        <form
          className="v-inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const transactionId = new FormData(e.currentTarget).get(
              "transactionId",
            );
            setBusy(true);
            setError("");
            setSaved(false);
            try {
              await request("/owner/payments/reconcile", "POST", {
                transactionId,
              });
              setSaved(true);
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="v-field">
            {t(
              "إعادة التحقق من معاملة Paymob",
              "Reconcile a Paymob transaction",
            )}
            <input
              name="transactionId"
              inputMode="numeric"
              pattern="[0-9]{1,20}"
              required
              placeholder={t("رقم المعاملة", "Transaction ID")}
            />
          </label>
          <button className="v-button" disabled={busy || !data.billingReady}>
            {t("تحقق من بوابة الدفع", "Verify with payment provider")}
          </button>
          <small>
            {t(
              "لا يفعّل الاشتراك إلا بعد تأكيد بوابة الدفع.",
              "Access is granted only after confirmation from the payment provider.",
            )}
          </small>
        </form>
      )}
      {error && (
        <p className="v-alert" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
