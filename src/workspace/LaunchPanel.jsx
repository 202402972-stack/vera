import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStoreScope } from "./StoreScope";
import { request } from "@/platform/api";
import { useLanguage } from "@/i18n/LanguageContext";
export default function LaunchPanel() {
  const scope = useStoreScope(),
    { language } = useLanguage(),
    t = (ar, en) => (language === "ar" ? ar : en);
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const load = useCallback(
    () =>
      request(`/stores/${scope.id}/readiness`)
        .then(setData)
        .catch((e) => setError(e.message)),
    [scope.id],
  );
  useEffect(() => {
    load();
  }, [load, scope.id]);
  const labels = {
    identity: t("هوية العلامة", "Brand identity"),
    product: t("منتج صالح للبيع", "A sellable product"),
    shipping: t("بلد وعملة وشحن", "Country, currency and shipping"),
    payment: t("وسيلة دفع", "Payment method"),
    policies: t("تواصل وسياسات مراجعة", "Reviewed contact and policies"),
    mobile: t("معاينة الموبايل", "Mobile preview"),
  };
  return (
    <section className="v-panel launch-panel">
      <h2>{t("خطوتك التالية", "Your next step")}</h2>
      {data && (
        <>
          <p>
            {data.percent}% ·{" "}
            {data.publicationState === "draft"
              ? t("مسودة خاصة", "Private draft")
              : t("منشور", "Published")}
          </p>
          <ul>
            {data.checks.map((c) => (
              <li key={c.id}>
                {c.ready ? "✓" : "○"}{" "}
                <Link to={scope.adminBase + "/" + c.section}>
                  {labels[c.id]}
                </Link>
              </li>
            ))}
          </ul>
          <div className="v-actions">
            <a
              className="v-button"
              href={scope.publicBase + "?preview=1"}
              target="_blank"
              rel="noreferrer"
            >
              {t("معاينة خاصة", "Private preview")}
            </a>
            <button onClick={load}>
              {t("تحديث الجاهزية", "Refresh readiness")}
            </button>
            <button
              disabled={!data.canPublish}
              onClick={async () => {
                try {
                  await request(`/stores/${scope.id}/publish`, "POST", {});
                  setStatus(t("نُشر المتجر", "Store published"));
                  load();
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              {t("نشر المتجر", "Publish store")}
            </button>
          </div>
          <p>
            {t(
              "راجع التواصل وسياسات الشحن والإرجاع ثم معاينة الهاتف؛ الإقرار لا يغني عن استكمال البيانات.",
              "Review contact, shipping and returns policies, then the mobile preview; confirmation also requires complete data.",
            )}
          </p>
          {["policies", "mobile"].map((k) => (
            <label key={k}>
              <input
                type="checkbox"
                checked={!!data.review?.[k]}
                onChange={async (e) => {
                  try {
                    setData(
                      await request(
                        `/stores/${scope.id}/launch-review`,
                        "PATCH",
                        { [k]: e.target.checked },
                      ),
                    );
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              />
              {labels[k]}
            </label>
          ))}
        </>
      )}
      {error && (
        <p role="alert">
          {error}
          <button onClick={load}>{t("إعادة المحاولة", "Retry")}</button>
        </p>
      )}
      <p role="status">{status}</p>
    </section>
  );
}
