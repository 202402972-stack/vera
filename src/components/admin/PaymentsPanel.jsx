import React, { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { api, jsonRequest } from "@/api/store";
import { Panel, Field, Notice, Busy, SaveButton } from "./AdminUI";
export default function PaymentsPanel({ notify }) {
  const { language } = useLanguage(),
    t = (en, ar) => (language === "ar" ? ar : en),
    [value, setValue] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const reload = () =>
    api("/admin/payments")
      .then(setValue)
      .catch((e) => setError(e.message));
  useEffect(() => {
    reload();
  }, []);
  const set = (k, v) => setValue((old) => ({ ...old, [k]: v }));
  return (
    <div className="space-y-6">
      <Panel
        title={t("Shopper payments", "مدفوعات العملاء")}
        subtitle={t(
          "Cash on delivery and your merchant Paymob account.",
          "الدفع عند الاستلام وحساب Paymob الخاص بمتجرك.",
        )}
      >
        {error && <Notice error>{error}</Notice>}
        {!value ? (
          <Busy />
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api("/admin/payments", jsonRequest("PUT", value));
                await reload();
                notify(t("Payment settings saved.", "تم حفظ إعدادات الدفع."));
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Notice>
              {t(
                "Credentials are encrypted. Leave secret fields blank to retain saved values. These settings are separate from your VÉRA subscription.",
                "بيانات الاعتماد مشفّرة. اترك حقول الأسرار فارغة للاحتفاظ بالقيم المحفوظة. هذه الإعدادات مستقلة عن اشتراك VÉRA.",
              )}
            </Notice>
            {!value.httpsReady && (
              <Notice>
                {t(
                  "Set the deployment PUBLIC_URL to your HTTPS origin before online payment becomes available.",
                  "اضبط PUBLIC_URL على عنوان HTTPS للنشر قبل إتاحة الدفع الإلكتروني.",
                )}
              </Notice>
            )}
            <p className="studio-status mb-5">
              {value.configured
                ? t("Online payments configured", "الدفع الإلكتروني مضبوط")
                : t("Cash on delivery active", "الدفع عند الاستلام متاح")}
            </p>
            <label className="flex gap-3 mb-6">
              <input
                type="checkbox"
                checked={value.enabled}
                onChange={(e) => set("enabled", e.target.checked)}
              />
              {t("Enable Paymob for shoppers", "إتاحة Paymob للعملاء")}
            </label>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                ["publicKey", t("Public key", "المفتاح العام")],
                [
                  "integrationId",
                  t("Card integration ID", "رقم تكامل البطاقات"),
                ],
                ["secretKey", t("Secret key", "المفتاح السري")],
                ["apiKey", t("API key", "مفتاح API")],
                ["hmacSecret", t("HMAC secret", "سر HMAC")],
              ].map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  type={
                    ["publicKey", "integrationId"].includes(key)
                      ? "text"
                      : "password"
                  }
                  autoComplete="off"
                  value={value[key] || ""}
                  onChange={(v) => set(key, v)}
                  hint={
                    value["has" + key[0].toUpperCase() + key.slice(1)]
                      ? t("Saved securely", "محفوظ بأمان")
                      : ""
                  }
                />
              ))}
              <div>
                <strong>
                  {t("Processed callback URL", "عنوان إشعار تأكيد الدفع")}
                </strong>
                <p className="admin-hint mt-2" dir="ltr">
                  {value.callbackPath}
                </p>
                <p className="admin-hint mt-2">
                  {t(
                    "Prefix with your HTTPS origin and configure it in the merchant integration.",
                    "أضف عنوان HTTPS للمنصة في البداية واضبطه في تكامل التاجر.",
                  )}
                </p>
              </div>
            </div>
            <SaveButton busy={busy} />
          </form>
        )}
      </Panel>
      <Panel
        title={t("Reconcile a payment", "التحقق من دفعة")}
        subtitle={t(
          "Fetch the provider transaction and verify its order, currency and amount.",
          "جلب معاملة مزوّد الدفع والتحقق من الطلب والعملة والمبلغ.",
        )}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const transactionId = new FormData(e.currentTarget).get(
              "transactionId",
            );
            setBusy(true);
            try {
              await api(
                "/admin/payments/reconcile",
                jsonRequest("POST", { transactionId }),
              );
              notify(
                t(
                  "Payment reconciled. Check the order for its current status.",
                  "تم التحقق من الدفعة. راجع حالة الطلب.",
                ),
              );
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="admin-field">
            {t("Provider transaction ID", "رقم معاملة الدفع")}
            <input
              name="transactionId"
              required
              inputMode="numeric"
              pattern="[0-9]+"
            />
          </label>
          <button className="admin-upload-button" disabled={busy}>
            {t("Verify transaction", "التحقق من المعاملة")}
          </button>
        </form>
      </Panel>
    </div>
  );
}
