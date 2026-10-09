import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
export default function LandingJourney({ config }) {
  const { language } = useLanguage(),
    t = (ar, en) => (language === "ar" ? ar : en),
    [active, setActive] = useState("products");
  const features = [
    [
      "products",
      "المنتجات",
      "Products",
      "صور وخيارات ومخزون وأسعار؛ رتّب مجموعاتك وانشر المنتجات المكتملة فقط.",
      "Images, options, inventory and prices. Organize collections and publish complete products.",
    ],
    [
      "orders",
      "الطلبات",
      "Orders",
      "طلبات فعلية وحالات وشحن وتتبّع للعميل؛ الدفع الإلكتروني يظهر بعد إعداده.",
      "Real orders, statuses, shipping and customer tracking. Online payment appears after configuration.",
    ],
    [
      "design",
      "التخصيص",
      "Design",
      "محتوى عربي وإنجليزي وصور وهوية مستقلة؛ معاينة الهاتف والديسكتوب قبل الحفظ.",
      "Independent Arabic and English copy, imagery and identity. Preview mobile and desktop before saving.",
    ],
  ];
  const detail = features.find((f) => f[0] === active);
  return (
    <>
      <section className="v-section v-move-section">
        <div className="v-section-heading">
          <span className="v-eyebrow">A NEW HOME FOR YOUR BRAND</span>
          <h2>
            {t("بداية جديدة،", "A fresh start,")}{" "}
            <em>{t("أو فصل جديد.", "or a new chapter.")}</em>
          </h2>
          <p>
            {t(
              "ابدأ بمسودة فارغة، أو انقل بيانات متجرك المتاحة ثم راجعها قبل النشر.",
              "Begin with an empty draft, or bring your available store data and review it before publishing.",
            )}
          </p>
        </div>
        <div className="v-transfer-steps">
          {[
            [
              "01",
              "الرابط أو CSV",
              "Link or CSV",
              "قراءة Shopify العامة كأفضل جهد وملفات Shopify/WooCommerce/VÉRA.",
              "Public Shopify reading is best effort; Shopify, WooCommerce and VÉRA CSV files are supported.",
            ],
            [
              "02",
              "راجع المحتوى",
              "Review the content",
              "صحّح العملة والمخزون والخيارات؛ الصور تُنقل محليًا، والنواقص لها تقرير.",
              "Confirm currency, inventory and options. Images are copied locally and missing data is reported.",
            ],
            [
              "03",
              "مسودتك في VÉRA",
              "Your VÉRA draft",
              "اختر القالب، ثم استكمل الشحن والسياسات ومعاينة الهاتف قبل النشر.",
              "Choose a template, then complete shipping, policies and mobile review before publishing.",
            ],
          ].map(([n, ar, en, descAr, descEn]) => (
            <article key={n}>
              <span>{n}</span>
              <h3>{t(ar, en)}</h3>
              <p>{t(descAr, descEn)}</p>
            </article>
          ))}
        </div>
        <div className="v-actions">
          <Link className="v-button" to="/login?intent=create">
            {t("ابدأ من الصفر", "Start from scratch")}
          </Link>
          <Link
            className="v-button v-button-secondary"
            to="/login?intent=import"
          >
            {t("انقل البيانات المتاحة", "Bring available data")}
          </Link>
        </div>
        <p className="v-fineprint">
          {t(
            "لا ضمان نقل كامل من الرابط: ٥٠٠ منتج و٤٠ متغيرًا لكل منتج، دون العملاء أو الطلبات أو كلمات المرور. المحتوى يحتاج إذن مالكه.",
            "A link cannot guarantee a complete transfer: 500 products, 40 variants per product; customers, orders and passwords are excluded. You need permission to import the content.",
          )}
        </p>
      </section>
      <section className="v-section v-inside-section">
        <div>
          <span className="v-eyebrow">BEHIND THE BEAUTIFUL STOREFRONT</span>
          <h2>
            {t("مساحة العمل", "A workspace")}{" "}
            <em>{t("التي تحتاجها.", "for your everyday.")}</em>
          </h2>
          <div
            role="tablist"
            aria-label={t("معاينة مساحة العمل", "Workspace preview")}
          >
            {features.map(([key, ar, en]) => (
              <button
                key={key}
                role="tab"
                aria-selected={active === key}
                aria-controls="landing-studio-detail"
                onClick={() => setActive(key)}
              >
                {t(ar, en)}
              </button>
            ))}
          </div>
          <div id="landing-studio-detail" role="tabpanel">
            <h3>{t(detail[1], detail[2])}</h3>
            <p>{t(detail[3], detail[4])}</p>
            <Link to="/login?intent=create">
              {t("افتح مساحة علامتك", "Open your brand workspace")} ↗
            </Link>
          </div>
        </div>
        <figure>
          <img
            src="/platform/assets/merchant-studio.png"
            loading="lazy"
            alt={t("معاينة لوحة متجر VÉRA", "VÉRA merchant studio preview")}
          />
          <figcaption>
            {t(
              "معاينة القالب؛ بيانات متجر تجريبي وليست إحصائيات عملاء.",
              "Template preview; sample store data, not customer statistics.",
            )}
          </figcaption>
        </figure>
      </section>
      <section className="v-section v-shopper-strip">
        <span className="v-eyebrow">MADE FOR THE PEOPLE WHO BUY</span>
        <h2>
          {t("من أول نظرة", "From first look")}{" "}
          <em>{t("إلى باب العميل.", "to their doorstep.")}</em>
        </h2>
        <div>
          {[
            ["موبايل وعربي وإنجليزي", "Mobile, Arabic & English"],
            ["خيارات ومفضلة وسلة", "Options, saved items & cart"],
            ["شراء كضيف وتتبع الطلب", "Guest checkout & order tracking"],
          ].map(([ar, en]) => (
            <p key={en}>{t(ar, en)}</p>
          ))}
        </div>
      </section>
      <section className="v-section">
        <div className="v-section-heading">
          <span className="v-eyebrow">CHOOSE YOUR CHARACTER</span>
          <h2>
            {t("ثلاث شخصيات،", "Three characters,")}{" "}
            <em>{t("مساحتك أنت.", "your own space.")}</em>
          </h2>
        </div>
        <div className="v-transfer-steps">
          {config.templates.map((template) => (
            <article key={template.id}>
              <h3>{template.name}</h3>
              <p>{t(template.descriptionAr, template.description)}</p>
              <Link to={"/login?intent=create&template=" + template.id}>
                {t("ابدأ بهذا القالب", "Start with this template")} ↗
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
