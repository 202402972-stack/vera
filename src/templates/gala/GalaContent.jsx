import React from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import useSettingsEditor from "@/hooks/useSettingsEditor";
import { ImagePicker } from "@/components/admin/AdminUI";
import { StructuredField } from "./StructuredField";
export default function GalaContent({ kind, notify }) {
  const { value, setValue, error, setError, busy, dirty, save } =
      useSettingsEditor(notify),
    { language } = useLanguage();
  const t = (en, ar) => (language === "ar" ? ar : en);
  if (!value)
    return (
      <p role={error ? "alert" : "status"}>
        {error || t("Loading…", "جارٍ التحميل…")}
      </p>
    );
  const bilingual = (group, key, label) => {
    const en = group ? value[group][key] : value[key],
      ar =
        (group
          ? value.translations?.ar?.[group]?.[key]
          : value.translations?.ar?.[key]) || "";
    return (
      <StructuredField
        key={group + "." + key}
        label={label}
        value={{ en, ar }}
        path={key}
        onChange={(v) =>
          setValue((prev) => {
            const next = structuredClone(prev);
            next.translations ||= {};
            next.translations.ar ||= {};
            if (group) {
              next[group][key] = v.en;
              next.translations.ar[group] ||= {};
              next.translations.ar[group][key] = v.ar;
            } else {
              next[key] = v.en;
              next.translations.ar[key] = v.ar;
            }
            return next;
          })
        }
      />
    );
  };
  return (
    <form className="gs-content" onSubmit={save} data-dirty={dirty}>
      <div className="gs-design-bar">
        <div>
          <h2>
            {kind === "identity"
              ? t("Your name. Your signature.", "اسمك. وهويتك.")
              : kind === "footer"
                ? t("Keep the conversation open.", "كن قريبًا من عملائك.")
                : t("Tell your story.", "احكِ حكايتك.")}
          </h2>
          <p>
            {t(
              "English and Arabic copy can be edited independently.",
              "يمكن تعديل النص العربي والإنجليزي بشكل مستقل.",
            )}
          </p>
        </div>
        <button className="gs-primary" disabled={busy || !dirty}>
          {t("Publish changes", "نشر التعديلات")}
        </button>
      </div>
      {error && (
        <p className="gs-error" role="alert">
          {error}
        </p>
      )}
      <div className="gs-content-grid">
        {kind === "identity" ? (
          <>
            <section>
              {bilingual(null, "name", t("Store name", "اسم المتجر"))}
              {bilingual(null, "tagline", t("Tagline", "وصف الهوية"))}
              {bilingual(
                null,
                "metaDescription",
                t("Search description", "وصف محركات البحث"),
              )}
            </section>
            <section>
              <ImagePicker
                kind="logo"
                label={t("Store logo", "شعار المتجر")}
                value={value.brand.logo}
                onError={setError}
                onChange={(logo) =>
                  setValue({ ...value, brand: { ...value.brand, logo } })
                }
              />
              {value.brand.logo && (
                <button
                  type="button"
                  className="gs-add"
                  onClick={() =>
                    setValue({ ...value, brand: { ...value.brand, logo: "" } })
                  }
                >
                  {t("Use the store name as logo", "استخدام اسم المتجر كشعار")}
                </button>
              )}
              <StructuredField
                label={t("Announcement bar", "شريط الإعلان")}
                path="announcement"
                value={value.brand.announcement}
                onChange={(announcement) =>
                  setValue({
                    ...value,
                    brand: { ...value.brand, announcement },
                  })
                }
              />
            </section>
          </>
        ) : kind === "footer" ? (
          <>
            <section>
              {bilingual(
                "footer",
                "text",
                t("Footer description", "وصف الفوتر"),
              )}
              {bilingual("footer", "location", t("Location", "العنوان"))}
              {bilingual(
                "footer",
                "rights",
                t("Copyright text", "نص حقوق النشر"),
              )}
              {["email", "phone"].map((key) => (
                <StructuredField
                  key={key}
                  path={key}
                  label={t(
                    key === "email" ? "Contact email" : "Phone",
                    key === "email" ? "بريد التواصل" : "الهاتف",
                  )}
                  value={value.footer[key]}
                  onChange={(v) =>
                    setValue({
                      ...value,
                      footer: { ...value.footer, [key]: v },
                    })
                  }
                />
              ))}
            </section>
            <section>
              <StructuredField
                path="socials"
                label={t("Social links", "روابط التواصل")}
                value={value.footer.socials}
                onChange={(socials) =>
                  setValue({ ...value, footer: { ...value.footer, socials } })
                }
              />
              <p className="gs-hint">
                {t(
                  "Edit navigation columns and newsletter in GALA design studio.",
                  "يمكنك تعديل أعمدة الروابط والنشرة البريدية من استوديو GALA.",
                )}
              </p>
            </section>
          </>
        ) : (
          <>
            <section>
              {bilingual("hero", "title", t("Hero heading", "عنوان الواجهة"))}
              {bilingual("hero", "text", t("Hero caption", "وصف الواجهة"))}
              {bilingual(
                "hero",
                "alt",
                t("Hero image description", "وصف صورة الواجهة"),
              )}
              {bilingual("story", "title", t("Story heading", "عنوان الحكاية"))}
              {bilingual("story", "text", t("Your story", "حكاية المتجر"))}
            </section>
            <section>
              {["shipping", "returns", "privacy", "terms"].map((key) =>
                bilingual(
                  "pages",
                  key,
                  t(
                    {
                      shipping: "Shipping policy",
                      returns: "Returns policy",
                      privacy: "Privacy policy",
                      terms: "Terms & conditions",
                    }[key],
                    {
                      shipping: "سياسة الشحن",
                      returns: "سياسة الاسترجاع",
                      privacy: "سياسة الخصوصية",
                      terms: "الشروط والأحكام",
                    }[key],
                  ),
                ),
              )}
            </section>
          </>
        )}
      </div>
    </form>
  );
}
