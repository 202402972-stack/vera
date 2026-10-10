import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  PackageCheck,
  Globe2,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { useCopy } from "./PlatformUI";
export default function LandingJourney() {
  const t = useCopy();
  return (
    <>
      <section className="v-features">
        <div className="v-section-heading">
          <span className="v-hero-badge">
            ✦ {t("كل التفاصيل، معًا", "Every detail, together")}
          </span>
          <h2>
            {t(
              "من أول منتج إلى أول طلب.",
              "From your collection to their doorstep.",
            )}
          </h2>
          <p>
            {t(
              "مساحة مدروسة لمنتجاتك وطلباتك وهوية علامتك.",
              "A considered home for your products, orders, and brand.",
            )}
          </p>
          <Link className="v-button" to="/login?intent=create">
            {t("أنشئ مساحتك", "Create your space")} <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="v-feature-grid">
          <article>
            <div className="v-feature-art v-feature-catalog" aria-hidden="true">
              <img
                src="/assets/atelier-alpaca-scarf.jpg"
                alt=""
                loading="lazy"
              />
              <span className="v-art-label">01 / COLLECTION</span>
              <strong>{t("منتجاتك", "Curate")}</strong>
            </div>
            <h3>{t("كل قطعة، في مكانها.", "A place for every piece.")}</h3>
            <p>
              {t(
                "صور وخيارات ومخزون وأسعار. رتّب مجموعاتك وانشر المنتجات المكتملة فقط.",
                "Images, options, inventory and prices. Organize your collections and publish complete products.",
              )}
            </p>
          </article>
          <article>
            <div className="v-feature-art v-feature-order" aria-hidden="true">
              <span className="v-art-label">02 / ORDERS</span>
              <div className="v-order-illustration">
                <PackageCheck strokeWidth={1} />
                <span />
                <span />
                <span />
              </div>
              <strong>{t("طلباتك", "Deliver")}</strong>
            </div>
            <h3>{t("من الطلب إلى باب العميل.", "Every order, considered.")}</h3>
            <p>
              {t(
                "تابع الطلبات والشحن وحالات التوصيل. الدفع عند الاستلام متاح، والدفع الإلكتروني بعد إعداد Paymob.",
                "Manage orders, shipping and delivery status. Accept cash on delivery, with online payments after Paymob setup.",
              )}
            </p>
          </article>
          <article>
            <div className="v-feature-art v-feature-design" aria-hidden="true">
              <span className="v-art-label">03 / YOUR IDENTITY</span>
              <div className="v-type-illustration">
                Aa <em>أ</em>
              </div>
              <div className="v-art-palette">
                <i />
                <i />
                <i />
                <i />
              </div>
              <strong>{t("هويتك", "Create")}</strong>
            </div>
            <h3>{t("شخصيتك، في كل تفصيلة.", "Your signature, everywhere.")}</h3>
            <p>
              {t(
                "اسمك وشعارك وألوانك، مع محتوى عربي وإنجليزي ومعاينة الهاتف والديسكتوب قبل الحفظ.",
                "Your name, logo and colours. Independent Arabic and English content, with mobile and desktop previews before saving.",
              )}
            </p>
          </article>
        </div>
      </section>
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
      <section className="v-section v-shopper-strip">
        <span className="v-eyebrow">MADE FOR THE PEOPLE WHO BUY</span>
        <h2>
          {t("من أول نظرة", "From first look")}{" "}
          <em>{t("إلى باب العميل.", "to their doorstep.")}</em>
        </h2>
        <div>
          <p>
            <Globe2 size={23} strokeWidth={1.3} />
            {t("موبايل وعربي وإنجليزي", "Mobile, Arabic & English")}
          </p>
          <p>
            <ShoppingBag size={23} strokeWidth={1.3} />
            {t("خيارات ومفضلة وسلة", "Options, saved items & cart")}
          </p>
          <p>
            <Truck size={23} strokeWidth={1.3} />
            {t("شراء كضيف وتتبع الطلب", "Guest checkout & order tracking")}
          </p>
        </div>
      </section>
    </>
  );
}
