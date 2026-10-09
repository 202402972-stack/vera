import LandingJourney from "./LandingJourney";
import "@/motion.css";

import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

import {
  ArrowUpRight,
  LayoutTemplate,
  SlidersHorizontal,
  Globe2,
  Check,
  ChevronDown,
} from "lucide-react";

import "./platform.css";

import { useCopy, Mark, Button, TemplateCard } from "./PlatformUI";
const assets = "/platform/assets/";
export default function Home({ config }) {
  const t = useCopy();
  const { language } = useLanguage();
  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: config.displayPricing?.displayDefaultCurrency || "USD",
  }).format(
    (config.displayPricing?.displayPrices?.[
      config.displayPricing.displayDefaultCurrency
    ] ||
      config.marketingPriceCents ||
      150) / 100,
  );
  return (
    <>
      <section className="v-hero">
        <div className="v-hero-top v-frame" aria-hidden="true">
          <img src={assets + "hero.jpg"} alt="" />
        </div>
        <div className="v-hero-left v-frame" aria-hidden="true">
          <img src={assets + "hero.jpg"} alt="" />
        </div>
        <div className="v-hero-right v-frame" aria-hidden="true">
          <img src={assets + "gala-storefront.png"} alt="" />
        </div>
        <div className="v-hero-copy">
          <span className="v-hero-badge">
            ✦ &nbsp; {t("مساحة لعلامتك", "Your online boutique")}
          </span>
          <h1>
            {t("متجر ", "Create ")}
            <em>{t("يشبهك.", "beautifully.")}</em>
            <br className="v-mobile-break" />
            {t(" تجربة ", " Sell ")}
            <em>{t("تترك أثرًا.", "distinctly.")}</em>
          </h1>
          <p>
            {t(
              "امنح علامتك واجهة تستحقها. اختر قالبك، أضف لمستك، وحوّل أول زيارة إلى بداية حكاية.",
              "Give your brand a place to belong. Choose a template, add your signature, and turn a first visit into a new beginning.",
            )}
          </p>
          <Button to="/login?intent=create">
            {t("ابدأ متجرك", "Get started")}
          </Button>
          <small>
            {t(
              "١٤ يومًا مجانًا · بدون بطاقة بنكية",
              "14 days free · No card required",
            )}
          </small>
        </div>
        <div className="v-mobile-laptop">
          <div className="v-laptop-screen">
            <img
              src={assets + "gala-storefront.png"}
              alt={t("قالب GALA على الكمبيوتر", "The GALA desktop storefront")}
              width="1440"
              height="1000"
            />
          </div>
          <div className="v-laptop-base" />
        </div>
      </section>
      <section className="v-intro">
        <div className="v-polaroid">
          <img
            src={assets + "hero.jpg"}
            alt={t("تفاصيل منتجات المتجر", "Store product details")}
            loading="lazy"
          />
          <span>MADE TO BE YOURS.</span>
        </div>
        <div>
          <p className="v-eyebrow">VÉRA · COMMERCE, CONSIDERED.</p>
          <h2>
            {t("لأفكار تستحق", "For ideas that deserve")}
            <br />
            <em>{t("أن تصبح علامة.", "to become a brand.")}</em>
          </h2>
          <p>
            {t(
              "ابدأ بالتصميم المناسب، واهتم بما تصنعه. متجرك ومنتجاتك وطلباتك في تجربة واحدة واضحة، من أول يوم.",
              "Start with the right design, and focus on what you create. Your storefront, products, and orders, together in one considered experience.",
            )}
          </p>
          <a href="#templates" className="v-text-link">
            {t("اكتشف البداية", "Find your starting point")}
            <ArrowUpRight size={18} />
          </a>
        </div>
      </section>
      <section id="templates" className="v-section">
        <div className="v-section-heading">
          <span className="v-eyebrow">01 / THE COLLECTION</span>
          <h2>
            {t("مساحة جاهزة.", "A considered canvas.")}
            <br />
            <em>{t("وشخصيتها منك.", "A signature that’s yours.")}</em>
          </h2>
          <p>
            {t(
              "GALA بفخامته، وأتيليه بدفئه، وFORM برؤيته العصرية. ثلاث هويات مختلفة، وإدارة متكاملة لعلامتك.",
              "GALA’s quiet luxury. The Atelier’s warm editorial character. FORM’s modern perspective. Three distinct storefronts, each ready for your brand.",
            )}
          </p>
        </div>
        {config.templates.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </section>
      <section id="how" className="v-how">
        <div className="v-section-heading">
          <span className="v-eyebrow">02 / YOUR NEXT CHAPTER</span>
          <h2>
            {t("من الفكرة", "From your first idea")}{" "}
            <em>{t("لأول طلب.", "to your first order.")}</em>
          </h2>
        </div>
        <div className="v-steps">
          {[
            [
              LayoutTemplate,
              t("اختر مساحتك", "Choose your canvas"),
              t(
                "ابدأ بقالب جاهز، وشوف تجربة متجرك قبل ما تبدأ.",
                "Explore the live template and find a home for your products.",
              ),
            ],
            [
              SlidersHorizontal,
              t("أضف شخصيتك", "Make it your own"),
              t(
                "اسمك، شعارك، ألوانك، منتجاتك. كل التفاصيل بين يديك.",
                "Your name, logo, colours, and catalogue. Every detail in your hands.",
              ),
            ],
            [
              Globe2,
              t("افتح أبوابك", "Open your doors"),
              t(
                "راجع المسودة الخاصة وقائمة الجاهزية وانشر متجرك، ثم تابع الطلبات الفعلية.",
                "Review your private draft and readiness checklist, publish it, then manage real orders.",
              ),
            ],
          ].map(([Icon, title, text], i) => (
            <article key={title}>
              <span className="v-step-number">0{i + 1}</span>
              <Icon strokeWidth={1.2} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="v-control">
        <div>
          <span className="v-eyebrow">03 / BEHIND THE BEAUTY</span>
          <h2>
            {t("واجهة أنيقة.", "Beautiful in front.")}
            <br />
            <em>{t("وإدارة أوضح.", "Considered behind it.")}</em>
          </h2>
          <p>
            {t(
              "لوحة متجرك تهتم بالتفاصيل: المنتجات والمخزون والطلبات والخصومات والشحن. ومساحتك في ڤيرا تجمع متاجرك واشتراكاتك في مكان واحد.",
              "Your store dashboard handles the details: products, inventory, orders, discounts, and shipping. Your VÉRA workspace brings your stores and subscriptions together.",
            )}
          </p>
          <ul>
            {[
              t("تخصيص الهوية والمحتوى", "Brand and content controls"),
              t("متابعة الطلبات والمخزون", "Order and inventory management"),
              t("إدارة مستقلة لكل متجر", "Independent store dashboards"),
            ].map((x) => (
              <li key={x}>
                <Check size={16} />
                {x}
              </li>
            ))}
          </ul>
          <Button to="/login?intent=create">
            {t("أنشئ مساحتك", "Create your space")}
            <ArrowUpRight size={16} />
          </Button>
        </div>
        <div className="v-dashboard-frame">
          <picture>
            <source
              media="(max-width: 767px)"
              srcSet={assets + `gala-studio-${language}-390.webp`}
            />
            <img
              src={assets + `gala-studio-${language}-1440.webp`}
              alt={t("معاينة لوحة إدارة GALA", "GALA store management preview")}
              loading="lazy"
              width="1440"
              height="1020"
            />
          </picture>
        </div>
        <small className="v-dashboard-caption">
          {t("معاينة ببيانات تجريبية", "Preview with sample data")}
        </small>
      </section>
      <LandingJourney config={config} />
      <section id="pricing" className="v-section v-pricing">
        <div>
          <span className="v-eyebrow">04 / A SIMPLE START</span>
          <h2>
            {t("بداية بسيطة.", "Start simply.")}
            <br />
            <em>{t("احتمالات كثيرة.", "Make it your own.")}</em>
          </h2>
          <p>
            {t(
              "جرّب ڤيرا ١٤ يومًا بدون بطاقة بنكية. بعدها اختَر تكمل باشتراك لمتجرك.",
              "Try VÉRA for 14 days, without a payment card. Then choose a subscription for your store.",
            )}
          </p>
        </div>
        <article className="v-price-card">
          <span className="v-eyebrow">THE FIRST EDITION</span>
          <div className="v-price" dir="ltr">
            {price}
            <small>{t("/ شهر لكل متجر", "/ month per store")}</small>
          </div>
          <p>
            {t(
              "كل ما تحتاجه لبدء متجرك",
              "The essentials for your online boutique",
            )}
          </p>
          <ul>
            {[
              t("قالب قابل للتخصيص بالكامل", "Fully customizable template"),
              t("متجر بالعربي والإنجليزي", "Arabic and English storefront"),
              t(
                "لوحة منتجات وطلبات وتحليلات",
                "Products, orders, and analytics",
              ),
              t("رابط خاص بالمتجر", "Your own store link"),
            ].map((x) => (
              <li key={x}>
                <Check size={16} />
                {x}
              </li>
            ))}
          </ul>
          <Button to="/login?intent=create">
            {t("ابدأ تجربتك المجانية", "Start your free trial")}
            <ArrowUpRight size={16} />
          </Button>
          <small>
            {t(
              "سعر عرض إرشادي؛ عملة ومبلغ التحصيل من خطة المزوّد المعتمدة يظهران قبل تأكيد الدفع.",
              "Display pricing is indicative; the approved provider plan’s currency and total are shown before payment.",
            )}
          </small>
        </article>
      </section>
      <section id="faq" className="v-section v-faq">
        <div className="v-section-heading">
          <span className="v-eyebrow">A FEW GOOD QUESTIONS</span>
          <h2>{t("قبل البداية.", "Before you begin.")}</h2>
        </div>
        {[
          [
            t("هل يمكن نقل متجري الحالي؟", "Can I bring my existing store?"),
            t(
              "نعم، عبر CSV أو قراءة رابط Shopify المتاح للعامة كأفضل جهد. راجع الأسعار والعملات والمخزون أولًا. الصفحات المحمية والطلبات والعملاء وكلمات المرور لا تُنقل؛ تحتاج إذن مالك المحتوى.",
              "Yes, through CSV or best-effort reading of a public Shopify link. Review prices, currencies and inventory first. Protected pages, orders, customers and passwords are excluded; content-owner permission is required.",
            ),
          ],
          [
            t("هل أحتاج بطاقة للبدء؟", "Do I need a card to begin?"),
            t(
              "لا تحتاج بطاقة لتجربة الحساب لمدة ١٤ يومًا. يبدأ الاشتراك المدفوع بعد موافقتك على مبلغ وعملة التحصيل المعتمدين.",
              "No card is required for the account’s 14-day trial. Paid billing begins after you approve the confirmed billing amount and currency.",
            ),
          ],
          [
            t(
              "هل يدعم العربية والدومين الخاص؟",
              "What about Arabic and a custom domain?",
            ),
            config.customDomainsReady
              ? t(
                  "واجهات عربية وإنجليزية ومحتوى قابل للتعديل. ابدأ برابط VÉRA، ثم اربط دومين اشتريته بنفسك من مساحة متجرك بعد ضبط DNS والتحقق من شهادة HTTPS.",
                  "Arabic and English interfaces with editable content. Start with a VÉRA address, then connect a domain you bought through your workspace after DNS and HTTPS verification.",
                )
              : t(
                  "واجهات عربية وإنجليزية ومحتوى قابل للتعديل. ربط الدومين الخاص من مساحة المتجر متاح بعد إعداد خدمة الدومينات على الاستضافة.",
                  "Arabic and English interfaces with editable content. Custom-domain connection becomes available in your workspace after hosting setup is complete.",
                ),
          ],
          [
            t("أقدر أغيّر شكل البراند؟", "Can I make it feel like my brand?"),
            t(
              "نعم. غيّر الاسم والشعار والألوان والنصوص والصور والمنتجات من لوحة المتجر.",
              "Yes. Change your name, logo, colours, text, imagery, and products from the store dashboard.",
            ),
          ],
          [
            t(
              "إيه الفرق بين لوحتي ولوحة المتجر؟",
              "How is my workspace different from my store dashboard?",
            ),
            t(
              "مساحتك لإدارة المتاجر والاشتراكات وروابط الدخول. لوحة المتجر لإدارة المنتجات والطلبات والتصميم.",
              "Your workspace manages stores, subscriptions, and access. Your store dashboard manages products, orders, and design.",
            ),
          ],
          [
            t(
              "هل المتجر يستقبل دفعًا إلكترونيًا؟",
              "Does the store accept card payments?",
            ),
            t(
              "الدفع عند الاستلام متاح. ويمكن للتاجر إعداد Paymob للدفع الإلكتروني. اشتراك VÉRA مستقل عن مدفوعات العملاء.",
              "Cash on delivery is available. Merchants can configure Paymob for online checkout. Your VÉRA subscription is separate from shopper payments.",
            ),
          ],
          [
            t("إيه اللي يحصل بعد ١٤ يوم؟", "What happens after 14 days?"),
            t(
              "تحتاج اشتراكًا نشطًا لاستمرار الواجهة العامة. بيانات متجرك تبقى محفوظة ولوحة الإدارة متاحة. إيقاف المتجر لا يلغي الاشتراك؛ إلغاء التجديد يتم من إعدادات الاشتراك.",
              "An active subscription keeps your storefront available. Your data is retained and your dashboard stays accessible. Pausing a store does not cancel billing; manage renewal in subscription settings.",
            ),
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>
              {q}
              <ChevronDown size={18} />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
      <section className="v-closing">
        <Mark large />
        <h2>
          {t("كل علامة عظيمة،", "Every great brand")}
          <br />
          <em>{t("تبدأ بمساحة.", "starts somewhere.")}</em>
        </h2>
        <Button to="/login?intent=create">
          {t("وهنا تبدأ مساحتك", "Let this be your beginning")}
          <ArrowUpRight size={16} />
        </Button>
        <Link className="v-text-link" to="/login?intent=import">
          {t("انقل متجرك الحالي", "Bring your existing store")}
        </Link>
      </section>
    </>
  );
}
