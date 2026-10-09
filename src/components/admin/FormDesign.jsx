import DesignPreview from "./DesignPreview";
import { useStoreApi } from "@/workspace/StoreScope";
import React, { useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { localizeSettings, updateStoreContent } from "@/i18n/content";
import useSettingsEditor from "@/hooks/useSettingsEditor";
import { Panel, Field, ImagePicker, Notice, Busy, SaveButton } from "./AdminUI";
import "@/templates/form/form.css";
export default function FormDesign({ notify }) {
  const api = useStoreApi(),
    [active, setActive] = useState("campaign"),
    [products, setProducts] = useState([]),
    [productQuery, setProductQuery] = useState("");
  useEffect(() => {
    api("/admin/products?limit=100")
      .then((r) => setProducts(r.products))
      .catch((e) => setProducts([]));
  }, [api]);
  const { language } = useLanguage(),
    t = (en, ar) => (language === "ar" ? ar : en);
  const { value, setValue, error, setError, busy, dirty, save } =
    useSettingsEditor(notify);
  if (!value) return error ? <Notice error>{error}</Notice> : <Busy />;
  const view = localizeSettings(value, language),
    update = (group, key, v) =>
      setValue((prev) => updateStoreContent(prev, language, group, key, v)),
    config = (key, v) =>
      setValue((prev) => ({ ...prev, form: { ...prev.form, [key]: v } }));
  return (
    <form
      onSubmit={save}
      data-dirty={dirty}
      className={"space-y-6 form-design-editor view-" + active}
    >
      <nav className="product-editor-sections">
        {[
          ["campaign", "Campaign", "الحملة"],
          ["content", "Sections & story", "الأقسام والحكاية"],
          ["preview", "Preview", "معاينة"],
        ].map(([k, en, ar]) => (
          <button key={k} type="button" onClick={() => setActive(k)}>
            {t(en, ar)}
          </button>
        ))}
      </nav>
      <Panel
        title={t("Store design · FORM", "تصميم المتجر · FORM")}
        subtitle={t(
          "Shape the campaign, adjust the crop, and choose what appears on your homepage.",
          "خصّص الحملة واضبط قصّ الصورة والأقسام الظاهرة في الصفحة الرئيسية.",
        )}
      >
        <Notice>
          {t(
            "English and Arabic copy are independent. Images and section settings are shared. Changes are published when you save.",
            "المحتوى العربي والإنجليزي مستقل. الصور وإعدادات الأقسام مشتركة. تُنشر التعديلات عند الحفظ.",
          )}
        </Notice>
        {error && <Notice error>{error}</Notice>}
        <div className="grid lg:grid-cols-2 gap-7">
          <div>
            <Field
              label={t("Hero heading", "عنوان الواجهة")}
              value={view.hero.title}
              multiline
              maxLength={100}
              onChange={(v) => update("hero", "title", v)}
            />
            <Field
              label={t("Hero caption", "وصف الواجهة")}
              value={view.hero.text}
              multiline
              maxLength={650}
              onChange={(v) => update("hero", "text", v)}
            />
            <Field
              label={t("Button label", "نص الزر")}
              value={view.hero.button}
              maxLength={30}
              onChange={(v) => update("hero", "button", v)}
            />
            <ImagePicker
              kind="wide"
              value={value.hero.image}
              onChange={(v) => update("hero", "image", v)}
              onError={setError}
              label={t("Campaign hero · 3:2", "صورة الواجهة · 3:2")}
            />
            <Field
              label={t(
                "Desktop vertical focal position (0–100)",
                "موضع الصورة الرأسي للديسكتوب (٠–١٠٠)",
              )}
              type="number"
              min={0}
              max={100}
              value={value.form.heroPosition}
              onChange={(v) => config("heroPosition", Number(v))}
            />
            <Field
              label={t(
                "Mobile horizontal focal position (0–100)",
                "موضع الصورة الأفقي للموبايل (٠–١٠٠)",
              )}
              type="number"
              min={0}
              max={100}
              value={value.form.mobilePosition}
              onChange={(v) => config("mobilePosition", Number(v))}
            />
          </div>
          <div>
            <div
              className="studio-form-preview"
              style={{
                "--form-green": value.brand.primary,
                "--form-ink": value.brand.foreground,
              }}
            >
              <img
                src={value.hero.image}
                alt={view.hero.alt}
                style={{ objectPosition: `center ${value.form.heroPosition}%` }}
              />
              <div>
                <small>{value.name}</small>
                <h2>{view.hero.title}</h2>
                <p>{view.hero.text}</p>
                <span className="form-button">{view.hero.button}</span>
              </div>
            </div>
            <p className="admin-hint mt-3">
              {t(
                "Desktop composition preview. Check mobile framing below.",
                "معاينة ترتيب الديسكتوب. راجع قصّ الموبايل بالأسفل.",
              )}
            </p>
            <div className="studio-form-mobile">
              <img
                src={value.hero.image}
                alt={view.hero.alt}
                style={{
                  objectPosition: `${value.form.mobilePosition}% center`,
                }}
              />
            </div>
          </div>
        </div>
      </Panel>
      <Panel title={t("Homepage sections", "أقسام الصفحة الرئيسية")}>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            [
              "newsletterEnabled",
              t("Newsletter subscription", "اشتراك النشرة"),
            ],
            ["categoriesEnabled", t("Category tiles", "بطاقات التصنيفات")],
            ["arrivalsEnabled", t("Product grid", "شبكة المنتجات")],
            ["campaignEnabled", t("Story campaign", "حملة حكاية المتجر")],
          ].map(([key, label]) => (
            <label key={key} className="flex gap-3 items-center">
              <input
                type="checkbox"
                checked={!!value.form[key]}
                onChange={(e) => config(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
        <label className="gs-field">
          {t("Section order", "ترتيب الأقسام")}
          <select
            value={(
              value.form.sectionOrder || ["categories", "arrivals", "campaign"]
            ).join(",")}
            onChange={(e) => config("sectionOrder", e.target.value.split(","))}
          >
            {[
              "categories,arrivals,campaign",
              "campaign,categories,arrivals",
              "arrivals,campaign,categories",
              "categories,campaign,arrivals",
            ].map((o) => (
              <option value={o} key={o}>
                {o
                  .split(",")
                  .map(
                    (k) =>
                      ({
                        categories: t("Categories", "التصنيفات"),
                        arrivals: t("Products", "المنتجات"),
                        campaign: t("Story", "الحكاية"),
                      })[k],
                  )
                  .join(" / ")}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>
            {t("Featured pieces · up to 20", "قطع مختارة · حتى ٢٠")}
          </legend>
          <label className="gs-field">
            {t("Search products", "ابحث في المنتجات")}
            <input
              type="search"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
            />
          </label>
          {products
            .filter((p) =>
              p.title.toLowerCase().includes(productQuery.toLowerCase()),
            )
            .slice(0, 50)
            .map((p) => (
              <label key={p.id}>
                <input
                  type="checkbox"
                  checked={(value.form.featuredIds || []).includes(p.id)}
                  disabled={
                    !(value.form.featuredIds || []).includes(p.id) &&
                    (value.form.featuredIds || []).length >= 20
                  }
                  onChange={(e) =>
                    config(
                      "featuredIds",
                      e.target.checked
                        ? [...(value.form.featuredIds || []), p.id]
                        : (value.form.featuredIds || []).filter(
                            (id) => id !== p.id,
                          ),
                    )
                  }
                />
                <img
                  src={p.image || p.images?.[0]?.url}
                  width="40"
                  height="48"
                  alt=""
                  loading="lazy"
                />
                {p.title}
              </label>
            ))}
        </fieldset>
        <div className="grid md:grid-cols-2 gap-7 mt-7">
          <div>
            <Field
              label={t("Campaign heading", "عنوان الحملة")}
              value={view.story.title}
              maxLength={80}
              onChange={(v) => update("story", "title", v)}
            />
            <Field
              label={t("Campaign copy", "نص الحملة")}
              multiline
              value={view.story.text}
              maxLength={2400}
              onChange={(v) => update("story", "text", v)}
            />
          </div>
          <ImagePicker
            kind="wide"
            value={value.form.campaignImage}
            onChange={(v) => config("campaignImage", v)}
            onError={setError}
            label={t("Story image", "صورة الحكاية")}
          />
        </div>
      </Panel>
      <section className="form-design-live-preview">
        <DesignPreview value={value} onError={setError} />
      </section>
      <SaveButton busy={busy} disabled={!dirty} dirty={dirty} />
    </form>
  );
}
