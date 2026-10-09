import React, { useEffect, useState } from "react";
import { request } from "@/platform/api";
import { useLanguage } from "@/i18n/LanguageContext";
export default function Connections({ onChange }) {
  const { language } = useLanguage(),
    t = (ar, en) => (language === "ar" ? ar : en),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [locations, setLocations] = useState({});
  useEffect(() => {
    let active = true;
    request("/import-connections")
      .then((d) => {
        if (active) {
          setData(d);
          onChange(d.connections.filter((c) => c.state === "active"));
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [revision, onChange]);
  const act = async (fn) => {
    setError("");
    setBusy(true);
    try {
      await fn();
      setRevision((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="v-panel">
      <summary>
        {t(
          "الربط الرسمي: Shopify وWooCommerce",
          "Official connections: Shopify & WooCommerce",
        )}
      </summary>
      <p>
        {t(
          "قراءة المنتجات فقط؛ أسرار الاتصال مشفرة ولا تُعرض. المخزون حسب موقع Shopify المختار، ولا يتوفر نقل الاشتراكات أو المنتجات الرقمية/المجمعة.",
          "Product reads only; credentials are encrypted and never displayed. Shopify stock uses the selected location. Subscriptions, digital and grouped products are unsupported.",
        )}
      </p>
      {error && <p role="alert">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = Object.fromEntries(new FormData(e.currentTarget));
          act(async () => {
            const r = await request(
              "/import-connections/shopify/start",
              "POST",
              form,
            );
            window.location.assign(r.url);
          });
        }}
      >
        <label className="v-field">
          {t("نطاق Shopify الرسمي", "Official Shopify domain")}
          <input
            name="domain"
            required
            pattern="[a-z0-9-]+\.myshopify\.com"
            placeholder="your-store.myshopify.com"
          />
        </label>
        <button disabled={busy || !data?.shopifyConfigured}>
          {t("اربط Shopify للقراءة", "Connect Shopify for reading")}
        </button>
        {data && !data.shopifyConfigured && (
          <p>
            {t(
              "يحتاج مسؤول المنصة إعداد تطبيق Shopify وعنوان callback HTTPS؛ CSV والقراءة العامة متاحان.",
              "The platform operator must configure a Shopify app and HTTPS callback. CSV and public reading are available.",
            )}
          </p>
        )}
      </form>
      <form
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            values = Object.fromEntries(new FormData(form));
          act(async () => {
            await request("/import-connections/woocommerce", "POST", values);
            form.reset();
          });
        }}
      >
        <h3>WooCommerce</h3>
        <div className="v-form-grid">
          <label className="v-field">
            {t("رابط HTTPS للمتجر", "Store HTTPS origin")}
            <input
              name="url"
              type="url"
              required
              placeholder="https://your-store.com"
            />
          </label>
          <label className="v-field">
            {t("مفتاح قراءة فقط", "Read-only consumer key")}
            <input
              name="key"
              type="password"
              required
              autoComplete="new-password"
            />
          </label>
          <label className="v-field">
            {t("السر", "Consumer secret")}
            <input
              name="secret"
              type="password"
              required
              autoComplete="new-password"
            />
          </label>
        </div>
        <label>
          <input type="checkbox" required />
          {t(
            "هذه المفاتيح للقراءة فقط ولدي إذن استخدامها",
            "These keys are read-only and I am authorized to use them",
          )}
        </label>
        <button disabled={busy}>{t("تحقق واربط", "Verify and connect")}</button>
      </form>
      {data?.connections.map((c) => (
        <article key={c.id}>
          <p>
            {c.provider} · <bdi>{c.domain}</bdi> ·{" "}
            {c.state === "active"
              ? t("متصل", "Connected")
              : t("مفصول", "Disconnected")}
          </p>
          {c.state === "active" && (
            <>
              <button
                disabled={busy}
                onClick={() =>
                  act(() => request("/import-connections/" + c.id, "DELETE"))
                }
              >
                {t("افصل وامسح السر", "Disconnect and erase credentials")}
              </button>
              {c.provider === "shopify" && (
                <>
                  <button
                    onClick={() =>
                      act(async () =>
                        setLocations({
                          ...locations,
                          [c.id]: (
                            await request(
                              "/import-connections/" + c.id + "/locations",
                            )
                          ).locations,
                        }),
                      )
                    }
                  >
                    {t("اختر موقع المخزون", "Choose inventory location")}
                  </button>
                  {locations[c.id] && (
                    <select
                      aria-label={t("موقع المخزون", "Inventory location")}
                      defaultValue=""
                      onChange={(e) =>
                        act(() =>
                          request(
                            "/import-connections/" + c.id + "/location",
                            "PATCH",
                            { location: e.target.value },
                          ),
                        )
                      }
                    >
                      <option value="">{t("اختر…", "Choose…")}</option>
                      {locations[c.id].map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              )}
            </>
          )}
        </article>
      ))}
    </details>
  );
}
