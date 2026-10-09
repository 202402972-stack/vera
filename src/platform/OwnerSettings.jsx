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
                displayPricing: data.displayPricing,
                features: data.features,
                importLimits: data.importLimits,
              });
              setSaved(true);
              window.dispatchEvent(new Event("platform-config-updated"));
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="v-form-grid">
            <label className="v-field">
              {t("عملة العرض الافتراضية", "Default display currency")}
              <select
                value={data.displayPricing.displayDefaultCurrency}
                onChange={(e) =>
                  setData({
                    ...data,
                    displayPricing: {
                      ...data.displayPricing,
                      displayDefaultCurrency: e.target.value,
                    },
                  })
                }
              >
                <option>USD</option>
                <option>EGP</option>
              </select>
            </label>
            {["USD", "EGP"].map((currency) => (
              <label className="v-field" key={currency}>
                {t("سعر العرض", "Display price")} {currency}
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={
                    data.displayPricing.displayPrices[currency] == null
                      ? ""
                      : data.displayPricing.displayPrices[currency] / 100
                  }
                  onChange={(e) =>
                    setData({
                      ...data,
                      displayPricing: {
                        ...data.displayPricing,
                        displayPrices: {
                          ...data.displayPricing.displayPrices,
                          [currency]: e.target.value
                            ? Math.round(Number(e.target.value) * 100)
                            : null,
                        },
                      },
                    })
                  }
                />
                <small>
                  {t(
                    "سعر إرشادي؛ التحصيل من خطة المزوّد المعتمدة.",
                    "Display only; actual charge follows the approved provider plan.",
                  )}
                </small>
              </label>
            ))}
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
          <fieldset>
            <legend>{t("حدود الاستيراد", "Import limits")}</legend>
            <div className="v-form-grid">
              {Object.entries(data.importLimits || {}).map(([key, value]) => (
                <label className="v-field" key={key}>
                  {
                    {
                      products: t("منتجات لكل مهمة", "Products per job"),
                      pages: t("صفحات قراءة", "Read pages"),
                      images: t(
                        "صور تحميل لكل مهمة",
                        "Downloaded images per job",
                      ),
                      imageBytes: t(
                        "سقف تحميل الصور بالميجابايت",
                        "Image budget in MB",
                      ),
                      fileBytes: t("حجم الملف بالميجابايت", "File limit in MB"),
                    }[key]
                  }
                  <input
                    type="number"
                    min={key.endsWith("Bytes") ? 0.001 : 1}
                    step={key.endsWith("Bytes") ? 0.001 : 1}
                    value={key.endsWith("Bytes") ? value / 1048576 : value}
                    onChange={(e) =>
                      setData({
                        ...data,
                        importLimits: {
                          ...data.importLimits,
                          [key]: Math.round(
                            Number(e.target.value) *
                              (key.endsWith("Bytes") ? 1048576 : 1),
                          ),
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{t("إتاحة الميزات", "Feature availability")}</legend>
            {Object.entries(data.features || {}).map(([name, enabled]) => (
              <label key={name} style={{ display: "block", padding: 8 }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) =>
                    setData({
                      ...data,
                      features: { ...data.features, [name]: e.target.checked },
                    })
                  }
                />
                {
                  {
                    workspace: t("مساحة التاجر الموحدة", "Unified workspace"),
                    importCsv: t("النقل من CSV", "CSV imports"),
                    importUrl: t("قراءة الرابط العام", "Public URL imports"),
                    providerConnectors: t(
                      "الربط الرسمي",
                      "Official connectors",
                    ),
                    displayPricing: t("أسعار العرض الجديدة", "Display pricing"),
                  }[name]
                }
              </label>
            ))}
          </fieldset>
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
                "تم الحفظ وتحديث سعر العرض.",
                "Saved. Display pricing updated.",
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
              window.dispatchEvent(new Event("platform-config-updated"));
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
