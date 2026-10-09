import { useStore } from "@/hooks/useStore";
import React, { useEffect, useState } from "react";
import { useStoreApi } from "@/workspace/StoreScope";
import useSettingsEditor from "@/hooks/useSettingsEditor";
import { useLanguage } from "@/i18n/LanguageContext";
export default function FinancialSettings({ notify }) {
  const { baseStore } = useStore(),
    api = useStoreApi(),
    { language } = useLanguage(),
    t = (ar, en) => (language === "ar" ? ar : en);
  const { value, setValue, save, dirty, busy, error } =
    useSettingsEditor(notify);
  const [products, setProducts] = useState([]),
    [currency, setCurrency] = useState(""),
    [rate, setRate] = useState(1),
    [action, setAction] = useState("keep_numbers"),
    [approved, setApproved] = useState(false);
  useEffect(() => {
    api("/admin/products?limit=10")
      .then((r) => setProducts(r.products))
      .catch(() => {});
  }, [api]);
  if (!value) return <p role="status">{error || "…"}</p>;
  return (
    <form className="v-panel" data-dirty={dirty} onSubmit={save}>
      <h2>
        {t(
          "عملة الأسعار وإعادة التسعير",
          "Price currency and explicit repricing",
        )}
      </h2>
      <p>
        {t(
          "الطلبات السابقة تحتفظ بعملتها. تغيير الرمز لا يحول ١٠٠ دولار إلى قيمتها بالجنيه. راجع الأثر قبل الاعتماد.",
          "Previous orders keep their currency. Changing the symbol does not convert the value of 100 USD to EGP. Review the impact first.",
        )}
      </p>
      <label>
        {t("العملة المستهدفة", "Target currency")}
        <select
          value={currency || value.checkout.currency}
          onChange={(e) => {
            setCurrency(e.target.value);
            setApproved(false);
          }}
        >
          {["USD", "EGP", "EUR", "GBP", "SAR", "AED"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        {t("الأثر", "Action")}
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setApproved(false);
          }}
        >
          <option value="keep_numbers">
            {t(
              "احتفظ بالأرقام دون تحويل",
              "Keep numeric prices without conversion",
            )}
          </option>
          <option value="reprice">
            {t("إعادة تسعير بمعدل صريح", "Reprice with an explicit rate")}
          </option>
        </select>
      </label>
      {action === "reprice" && (
        <label>
          {t(
            "المعدل المعتمد؛ لا جلب سعر صرف تلقائي",
            "Approved rate; no automatic exchange rate",
          )}
          <input
            type="number"
            min="0.00001"
            step="any"
            value={rate}
            onChange={(e) => {
              setRate(Number(e.target.value));
              setApproved(false);
            }}
          />
        </label>
      )}
      <ul>
        {products.map((p) => (
          <li key={p.id}>
            {p.title}: {(p.variants[0].price_in_cents / 100).toFixed(2)}{" "}
            {baseStore.checkout.currency} →{" "}
            {(
              (p.variants[0].price_in_cents *
                (action === "reprice" ? rate : 1)) /
              100
            ).toFixed(2)}{" "}
            {currency || value.checkout.currency}
          </li>
        ))}
      </ul>
      <label>
        <input
          type="checkbox"
          checked={approved}
          onChange={(e) => {
            setApproved(e.target.checked);
            if (e.target.checked)
              setValue({
                ...value,
                checkout: {
                  ...value.checkout,
                  currency: currency || value.checkout.currency,
                  symbol: currency || value.checkout.currency,
                },
                currencyChange: { action, rate },
              });
          }}
        />
        {t(
          "راجعت الأثر وأعتمد الأسعار الجديدة",
          "I reviewed and approve the new prices",
        )}
      </label>
      <button disabled={!approved || busy}>
        {t("حفظ العملة والأسعار", "Save currency and prices")}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
