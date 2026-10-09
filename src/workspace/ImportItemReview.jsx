import React, { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
const money = (value) => (value == null ? "" : (value / 100).toFixed(2));
export default function ImportItemReview({ item, busy, onSave }) {
  const { language } = useLanguage(),
    t = (ar, en) => (language === "ar" ? ar : en),
    [value, setValue] = useState(item.data),
    [selected, setSelected] = useState(!!item.selected);
  const update = (key, v) => setValue((s) => ({ ...s, [key]: v })),
    variant = (i, key, v) =>
      setValue((s) => ({
        ...s,
        variants: s.variants.map((x, n) => (n === i ? { ...x, [key]: v } : x)),
      }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          itemId: item.id,
          selected,
          currency: value.currency,
          title: value.title,
          description: value.description,
          category: value.category,
          images: value.images,
          variants: value.variants,
          priceCurrencyReviewed: value.priceCurrencyReviewed === true,
        });
      }}
    >
      <div className="v-form-grid">
        <label className="v-field">
          {t("اسم المنتج", "Product title")}
          <input
            required
            maxLength={90}
            value={value.title}
            onChange={(e) => update("title", e.target.value)}
          />
        </label>
        <label className="v-field">
          {t("تصنيف المنتج", "Category")}
          <input
            maxLength={40}
            value={value.category || ""}
            onChange={(e) => update("category", e.target.value)}
          />
        </label>
        <label className="v-field">
          {t(
            "عملة الأسعار المؤكدة؛ لا تحويل تلقائي",
            "Confirmed price currency; no automatic conversion",
          )}
          <select
            required
            value={value.currency || ""}
            onChange={(e) => update("currency", e.target.value)}
          >
            <option value="">…</option>
            {["USD", "EGP", "EUR", "GBP", "SAR", "AED"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="v-field">
        {t("روابط الصور؛ رابط لكل سطر", "Image URLs; one per line")}
        <textarea
          value={value.images.join("\n")}
          onChange={(e) =>
            update(
              "images",
              e.target.value
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean),
            )
          }
        />
      </label>
      <details>
        <summary>{t("الوصف", "Description")}</summary>
        <textarea
          aria-label={t("وصف المنتج", "Product description")}
          value={value.description || ""}
          onChange={(e) => update("description", e.target.value)}
        />
      </details>
      {value.variants.some(
        (v) => v.sourceCurrency && v.sourceCurrency !== value.currency,
      ) && (
        <label>
          <input
            type="checkbox"
            required
            checked={!!value.priceCurrencyReviewed}
            onChange={(e) => update("priceCurrencyReviewed", e.target.checked)}
          />
          {t(
            "راجعت أسعار كل الخيارات وأؤكد أن الأرقام بهذه العملة؛ لا تحويل تلقائي",
            "I reviewed every variant price and confirm the numbers use this currency; no automatic conversion",
          )}
        </label>
      )}
      <fieldset>
        <legend>
          {t(
            "راجع كل خيار وسعر ومخزون",
            "Review every option, price and inventory",
          )}
        </legend>
        {value.variants.map((v, i) => (
          <details key={v.externalId || i} open={i === 0}>
            <summary>
              {v.title || v.sku || i + 1} · {money(v.priceMinor)}{" "}
              {value.currency}
            </summary>
            <div className="v-form-grid">
              <label className="v-field">
                {t("السعر المؤكد", "Confirmed price")}
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={money(v.priceMinor)}
                  onChange={(e) =>
                    variant(
                      i,
                      "priceMinor",
                      e.target.value === ""
                        ? null
                        : Math.round(Number(e.target.value) * 100),
                    )
                  }
                />
              </label>
              <label className="v-field">
                SKU
                <input
                  value={v.sku || ""}
                  onChange={(e) => variant(i, "sku", e.target.value)}
                />
              </label>
              <label className="v-field">
                {t("مخزون هذا المتغير", "This variant’s stock")}
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  required={!v.unlimited}
                  disabled={!!v.unlimited}
                  value={v.stockKnown && v.stock != null ? v.stock : ""}
                  onChange={(e) =>
                    setValue((s) => ({
                      ...s,
                      variants: s.variants.map((x, n) =>
                        n === i
                          ? {
                              ...x,
                              stock:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                              stockKnown: e.target.value !== "",
                              unlimited: false,
                            }
                          : x,
                      ),
                    }))
                  }
                />
              </label>
            </div>
            <label>
              <input
                type="checkbox"
                checked={!!v.unlimited}
                onChange={(e) =>
                  setValue((s) => ({
                    ...s,
                    variants: s.variants.map((x, n) =>
                      n === i
                        ? {
                            ...x,
                            unlimited: e.target.checked,
                            stockKnown: e.target.checked || x.stock != null,
                          }
                        : x,
                    ),
                  }))
                }
              />
              {t(
                "أؤكد البيع دون حد مخزون لهذا المتغير",
                "I confirm unlimited inventory for this variant",
              )}
            </label>
            <p>
              {v.optionValues?.map((o) => o.name + ": " + o.value).join(" · ")}
            </p>
          </details>
        ))}
      </fieldset>
      <label>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => setSelected(e.target.checked)}
        />
        {t("حدد للنقل", "Select to import")}
      </label>
      <button disabled={busy}>{t("احفظ المراجعة", "Save review")}</button>
    </form>
  );
}
