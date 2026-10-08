import OwnerSettings from "./OwnerSettings";
import React, { useEffect, useState } from "react";
import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Menu,
  X,
  LayoutTemplate,
  SlidersHorizontal,
  Globe2,
  ShieldCheck,
  Store,
  Pause,
  Play,
  ExternalLink,
  Copy,
  KeyRound,
  Plus,
  LogOut,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  LoaderCircle,
  CreditCard,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import "./platform.css";
const assets = "/platform/assets/";
export async function request(path, method = "GET", body) {
  const r = await fetch("/api/platform" + path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Please try again.");
  return data;
}
function useCopy() {
  const { language } = useLanguage();
  return (ar, en) => (language === "ar" ? ar : en);
}
function statusLabel(value, t) {
  const labels = {
    trial: ["تجربة مجانية", "Free trial"],
    trialing: ["تجربة مجانية", "Free trial"],
    active: ["نشط", "Active"],
    canceled: ["تم إلغاء التجديد", "Renewal canceled"],
    cancelled: ["تم إلغاء التجديد", "Renewal canceled"],
    paid: ["مدفوع", "Paid"],
    pending: ["قيد التأكيد", "Pending"],
    failed: ["لم يكتمل", "Failed"],
    refunded: ["مسترد", "Refunded"],
    suspended: ["موقوف", "Suspended"],
  };
  return labels[value] ? t(...labels[value]) : value;
}
function actionLabel(value, t) {
  const labels = {
    "auth.login": ["تسجيل دخول", "Signed in"],
    "store.created": ["إنشاء متجر", "Store created"],
    "store.paused": ["إيقاف المتجر مؤقتًا", "Store paused"],
    "store.resumed": ["تشغيل المتجر", "Store resumed"],
    "store.password_reset": [
      "تغيير كلمة مرور المتجر",
      "Store password changed",
    ],
    "store.admin_entry": ["دخول لوحة المتجر", "Entered store dashboard"],
    "owner.suspended": ["إيقاف إداري للمتجر", "Store suspended by owner"],
    "owner.restored": ["رفع الإيقاف الإداري", "Store restored by owner"],
    "owner.settings_updated": [
      "تحديث إعدادات المنصة",
      "Platform settings updated",
    ],
    "owner.payment_reconciled": ["إعادة التحقق من دفعة", "Payment reconciled"],
  };
  return labels[value]
    ? t(...labels[value])
    : value.startsWith("paymob.")
      ? t("دفعة: ", "Payment: ") + statusLabel(value.slice(7), t)
      : value;
}
function Mark({ large = false }) {
  return (
    <span className={"v-wordmark" + (large ? " v-large" : "")} dir="ltr">
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <path
          d="M9 14h16l20 49H30zM49 14h15L45 63l-8-20zM30 63h15l-7 9z"
          fill="currentColor"
        />
      </svg>
      <span>
        VÉRA<small>COMMERCE, CONSIDERED.</small>
      </span>
    </span>
  );
}
function Button({ children, to, ...props }) {
  return to ? (
    <Link className="v-button" to={to} {...props}>
      {children}
    </Link>
  ) : (
    <button className="v-button" {...props}>
      {children}
    </button>
  );
}
function Password({ name, label, minLength = 12 }) {
  const [visible, setVisible] = useState(false);
  const t = useCopy();
  return (
    <label className="v-field">
      {label}
      <span className="v-password">
        <input
          name={name}
          type={visible ? "text" : "password"}
          minLength={minLength}
          maxLength={128}
          required
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={
            visible
              ? t("إخفاء كلمة المرور", "Hide password")
              : t("إظهار كلمة المرور", "Show password")
          }
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}
function Header({ user, onLogout }) {
  const { language, setLanguage } = useLanguage(),
    t = useCopy(),
    location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location]);
  return (
    <header className="v-header">
      <Link to="/" aria-label="VÉRA">
        <Mark />
      </Link>
      <nav
        className={open ? "v-nav open" : "v-nav"}
        aria-label={t("القائمة الرئيسية", "Main navigation")}
      >
        <Link to="/templates">{t("القوالب", "Templates")}</Link>
        <a href="/#how">{t("كيف تبدأ", "How it works")}</a>
        <a href="/#pricing">{t("الأسعار", "Pricing")}</a>
        <a href="/#faq">{t("الأسئلة الشائعة", "FAQs")}</a>
        {user?.isOwner && <Link to="/owner">{t("الإدارة", "Owner")}</Link>}
      </nav>
      <div className="v-header-actions">
        <button
          className="v-language"
          onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
          aria-label={t("Switch to English", "التبديل للعربية")}
        >
          <Globe2 size={15} />
          {language === "ar" ? "EN" : "عربي"}
        </button>
        {user ? (
          <>
            <Link className="v-signin" to="/workspace">
              {t("مساحتي", "Workspace")}
            </Link>
            <button
              className="v-logout"
              aria-label={t("تسجيل الخروج", "Sign out")}
              onClick={onLogout}
            >
              <LogOut size={17} />
            </button>
          </>
        ) : (
          <Link className="v-signin" to="/login">
            {t("دخول", "SIGN IN")}
          </Link>
        )}
        <button
          className="v-menu"
          aria-expanded={open}
          aria-label={t("القائمة", "Menu")}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
function Footer({ config }) {
  const t = useCopy();
  return (
    <footer className="v-footer">
      <div>
        <Link to="/">
          <Mark />
        </Link>
        <p>{t("مساحة تليق بما تصنعه.", "A home for what you create.")}</p>
      </div>
      <div>
        <Link to="/templates">{t("القوالب", "Templates")}</Link>
        <Link to="/privacy">{t("الخصوصية", "Privacy")}</Link>
        <Link to="/terms">{t("الشروط", "Terms")}</Link>
        {config.supportEmail && (
          <a href={"mailto:" + config.supportEmail}>
            {t("تواصل معنا", "Contact")}
          </a>
        )}
        <Link to="/owner">{t("الإدارة", "Admin")}</Link>
      </div>
      <small>© {new Date().getFullYear()} VÉRA</small>
    </footer>
  );
}
function TemplateCard({ template }) {
  const t = useCopy();
  return (
    <article className="v-template">
      <a
        className="v-template-image"
        href={"/demo/" + template.id}
        target="_blank"
        rel="noreferrer"
      >
        <span className="v-chip">
          AR / EN · {t("قالب المتجر", "STORE TEMPLATE")}
        </span>
        <img
          src={template.image}
          alt={
            t(template.nameAr, template.name) +
            " · " +
            t("معاينة المتجر", "Storefront preview")
          }
          loading="lazy"
          width="1440"
          height="1000"
        />
      </a>
      <div className="v-template-copy">
        <span className="v-eyebrow">
          {template.name.toUpperCase()} ·{" "}
          {template.id === "gala"
            ? "01"
            : template.id === "atelier"
              ? "02"
              : "03"}
        </span>
        <div
          className="v-template-palette"
          aria-label={t("ألوان القالب", "Template palette")}
        >
          {(
            template.palette ||
            (template.id === "form"
              ? ["#2a5547", "#172321", "#dce8ef", "#f7f9fa"]
              : ["#80623e", "#c0b095", "#faf8f4", "#302c27"])
          ).map((color) => (
            <span key={color} style={{ background: color }} />
          ))}
        </div>
        <h3>
          {template.tagline
            ? t(template.taglineAr, template.tagline)
            : template.id === "form"
              ? t("تفاصيل يومك، برؤية جديدة.", "Everyday. Reconsidered.")
              : t("كل تفصيلة، تحكي عنك.", "Every detail, distinctly yours.")}
        </h3>
        <p>{t(template.descriptionAr, template.description)}</p>
        <div className="v-tags">
          <span>{t("هوية مرنة", "Flexible identity")}</span>
          <span>{t("إدارة متكاملة", "Store management")}</span>
          <span>{t("موبايل أولًا", "Mobile first")}</span>
        </div>
        <div className="v-actions">
          <Button to={"/login?intent=create&template=" + template.id}>
            {t("ابدأ بهذا القالب", "Make it yours")}
            <ArrowUpRight size={16} />
          </Button>
          <a
            className="v-text-link"
            href={"/demo/" + template.id}
            target="_blank"
            rel="noreferrer"
          >
            {t("جرّب المتجر", "Explore the store")}
            <ExternalLink size={15} />
          </a>
        </div>
      </div>
    </article>
  );
}
function Home({ config }) {
  const t = useCopy();
  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((config.marketingPriceCents || 150) / 100);
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
                "شارك رابط متجرك، واستقبل الطلبات وتابعها من لوحتك.",
                "Share your store link. Receive orders and manage them from your dashboard.",
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
          <img
            src={assets + "merchant-studio.png"}
            alt={t("لوحة إدارة المتجر", "Store management dashboard")}
            loading="lazy"
            width="1440"
            height="1000"
          />
        </div>
      </section>
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
              "عملة ومبلغ التحصيل يظهران قبل تأكيد الدفع.",
              "The billing currency and total are shown before payment.",
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
      </section>
    </>
  );
}
function Login({ config }) {
  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get(
      "template",
    );
    if (config.templates.some((t) => t.id === selected))
      try {
        sessionStorage.setItem("vera-selected-template", selected);
      } catch {}
  }, [config.templates]);
  const t = useCopy(),
    location = useLocation();
  return (
    <main className="v-login">
      <div className="v-login-art">
        <img src={assets + "hero.jpg"} alt="" />
        <div>
          <Mark large />
          <h2>
            {t("حكاية جديدة.", "A new chapter.")}
            <br />
            <em>{t("بتوقيعك.", "Signed by you.")}</em>
          </h2>
          <p>
            {t(
              "خطوة واحدة تفصلك عن مساحتك.",
              "Your next chapter is one step away.",
            )}
          </p>
        </div>
      </div>
      <section className="v-login-form">
        <span className="v-eyebrow">YOUR SPACE AWAITS</span>
        <h1>{t("أهلًا بك في ڤيرا.", "Welcome to VÉRA.")}</h1>
        <p>
          {t(
            "حساب واحد، وكل متاجرك بين يديك.",
            "One account. Every store, in your hands.",
          )}
        </p>
        {location.search.includes("error") && (
          <p className="v-alert" role="alert">
            {t(
              "لم يكتمل الدخول. حاول مرة أخرى.",
              "Sign-in could not be completed. Please try again.",
            )}
          </p>
        )}
        {config.user ? (
          <Button to="/workspace">
            {t("افتح مساحتك", "Open your workspace")}
          </Button>
        ) : (
          <a
            aria-disabled={!config.googleReady}
            className={"v-google" + (!config.googleReady ? " disabled" : "")}
            href={
              config.googleReady
                ? "/api/platform/auth/google" +
                  (location.search.includes("create") ? "?intent=create" : "")
                : undefined
            }
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.4z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3v2.6A10 10 0 0 0 12 22z"
              />
              <path
                fill="#FBBC05"
                d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3a10 10 0 0 0 0 9z"
              />
              <path
                fill="#EA4335"
                d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.5l3.4 2.6A6 6 0 0 1 12 5.9z"
              />
            </svg>
            {t("المتابعة باستخدام Google", "Continue with Google")}
          </a>
        )}
        {!config.googleReady && (
          <p className="v-notice">
            {t(
              "تسجيل الدخول سيتاح عند اكتمال إعداد الخدمة. يمكنك استكشاف القالب الآن.",
              "Sign-in will be available once service setup is complete. You can explore the template now.",
            )}{" "}
            <Link to="/templates">{t("استكشف", "Explore")}</Link>
          </p>
        )}
        <div className="v-login-divider" />
        <p className="v-fineprint">
          {t("باستمرارك، توافق على", "By continuing, you agree to our")}{" "}
          <Link to="/terms">{t("الشروط", "Terms")}</Link> {t("و", "and")}{" "}
          <Link to="/privacy">{t("سياسة الخصوصية", "Privacy Policy")}</Link>.
        </p>
        <span className="v-security">
          <ShieldCheck size={16} />
          {t(
            "دخول آمن. بدون كلمة مرور جديدة.",
            "Secure sign-in. No new password to remember.",
          )}
        </span>
      </section>
    </main>
  );
}
function StoreCard({ store, onRefresh, onAction }) {
  const t = useCopy();
  const [password, setPassword] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function action(fn) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="v-store-card">
      <div className="v-store-cover">
        <img src={assets + "gala-storefront.png"} alt="" />
        <span className={"v-status " + (store.available ? "live" : "")}>
          {store.suspended
            ? t("موقوف إداريًا", "Suspended")
            : store.available
              ? t("متاح", "Live")
              : store.paused
                ? t("متوقف مؤقتًا", "Paused")
                : t("يحتاج اشتراكًا", "Subscription needed")}
        </span>
      </div>
      <div className="v-store-body">
        <span className="v-eyebrow">THE ATELIER</span>
        <h2>{store.name}</h2>
        <div className="v-store-url">
          <a href={store.url} target="_blank" rel="noreferrer" dir="ltr">
            {window.location.host}
            {store.url}
          </a>
          <button
            aria-label={t("نسخ الرابط", "Copy link")}
            onClick={() =>
              action(async () => {
                await navigator.clipboard.writeText(
                  window.location.origin + store.url,
                );
                setNotice(t("تم نسخ الرابط", "Link copied"));
              })
            }
          >
            <Copy size={16} />
          </button>
        </div>
        <p className="v-fineprint">
          {t("التجربة حتى: ", "Trial until: ")}
          {new Date(store.trialUntil).toLocaleDateString()} ·{" "}
          {t("الاشتراك: ", "Billing: ")}
          {statusLabel(store.billingStatus, t)}
        </p>
        <div className="v-actions">
          <Button
            disabled={busy || store.suspended}
            onClick={() =>
              action(async () => {
                const r = await request(
                  `/stores/${store.id}/admin-entry`,
                  "POST",
                  {},
                );
                window.location.assign(r.url);
              })
            }
          >
            {t("لوحة المتجر", "Store dashboard")}
            <ArrowUpRight size={16} />
          </Button>
          <a
            className="v-icon-link"
            href={store.url}
            aria-label={t("زيارة المتجر", "Visit store")}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={19} />
          </a>
        </div>
        <div className="v-store-tools">
          <button
            disabled={busy || store.suspended}
            onClick={() =>
              action(async () => {
                await request("/stores/" + store.id, "PATCH", {
                  paused: !store.paused,
                });
                onRefresh();
              })
            }
          >
            {store.paused ? <Play size={15} /> : <Pause size={15} />}{" "}
            {store.paused ? t("تشغيل", "Resume") : t("إيقاف مؤقت", "Pause")}
          </button>
          <button onClick={() => setPassword(!password)}>
            <KeyRound size={15} />
            {t("كلمة المرور", "Password")}
          </button>
          <button onClick={() => onAction(store)}>
            <CreditCard size={15} />
            {t("الاشتراك", "Subscription")}
          </button>
        </div>
        {password && (
          <form
            className="v-inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              const p = new FormData(e.currentTarget).get("password");
              action(async () => {
                await request(`/stores/${store.id}/password`, "POST", {
                  password: p,
                });
                setPassword(false);
                setNotice(
                  t(
                    "تم تغيير كلمة المرور وإغلاق جلسات الإدارة السابقة.",
                    "Password changed. Previous dashboard sessions were closed.",
                  ),
                );
              });
            }}
          >
            <Password
              name="password"
              label={t("كلمة مرور الإدارة الجديدة", "New dashboard password")}
            />
            <Button disabled={busy}>
              {t("حفظ كلمة المرور", "Save password")}
            </Button>
          </form>
        )}
        {error && (
          <p className="v-alert" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="v-notice" role="status">
            {notice}
          </p>
        )}
      </div>
    </article>
  );
}
function Workspace({ config }) {
  const t = useCopy();
  const [stores, setStores] = useState(null),
    [error, setError] = useState(""),
    [create, setCreate] = useState(
      new URLSearchParams(window.location.search).has("create"),
    ),
    [busy, setBusy] = useState(false),
    [billing, setBilling] = useState(null),
    [invoices, setInvoices] = useState([]);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!config.user) return;
    let active = true;
    request("/stores")
      .then((r) => {
        if (active) setStores(r.stores);
      })
      .catch((e) => active && setError(e.message));
    request("/invoices")
      .then((r) => active && setInvoices(r.invoices))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [config.user, refresh]);
  if (!config.user) return <Login config={config} />;
  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await request("/stores", "POST", Object.fromEntries(form));
      setCreate(false);
      setRefresh((x) => x + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function billingAction(type, body = {}) {
    setBusy(true);
    setError("");
    try {
      const r = await request(`/stores/${billing.id}/${type}`, "POST", body);
      if (r.url) window.location.assign(r.url);
      else {
        setBilling(null);
        setRefresh((x) => x + 1);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="v-workspace">
      <div className="v-page-heading">
        <div>
          <span className="v-eyebrow">YOUR SPACE, BEAUTIFULLY ORGANIZED.</span>
          <h1>
            {t("أهلًا، ", "Welcome, ")}
            {config.user.name.split(" ")[0]}.
          </h1>
          <p>
            {t("متاجرك، وخطوتك التالية.", "Your stores. Your next chapter.")}
          </p>
        </div>
        <Button onClick={() => setCreate(!create)}>
          <Plus size={17} />
          {t("متجر جديد", "New store")}
        </Button>
      </div>
      {error && (
        <p className="v-alert" role="alert">
          {error}
        </p>
      )}
      {create && (
        <form className="v-create v-panel" onSubmit={submit}>
          <div>
            <span className="v-eyebrow">A NEW BEGINNING</span>
            <h2>{t("لنمنح فكرتك مساحة.", "Give your idea a home.")}</h2>
            <p>
              {t(
                "يمكنك تغيير الهوية والتفاصيل لاحقًا من لوحة المتجر.",
                "You can customize your brand and details later from the store dashboard.",
              )}
            </p>
          </div>
          <div className="v-form-grid">
            <label className="v-field">
              {t("اسم المتجر", "Store name")}
              <input
                name="name"
                required
                minLength={2}
                maxLength={80}
                placeholder={t("اسم علامتك", "Your brand name")}
              />
            </label>
            <label className="v-field">
              {t("عنوان المتجر", "Store address")}
              <div className="v-input-prefix" dir="ltr">
                <span>/s/</span>
                <input
                  name="slug"
                  required
                  pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
                  minLength={3}
                  maxLength={40}
                  placeholder="your-brand"
                  autoCapitalize="none"
                />
              </div>
              <small>
                {t(
                  "حروف إنجليزية صغيرة، أرقام وشرطات. لا يتغير بعد الإنشاء.",
                  "Lowercase letters, numbers and hyphens. Permanent after creation.",
                )}
              </small>
            </label>
            <label className="v-field">
              {t("القالب", "Template")}
              <select
                name="template"
                defaultValue={(() => {
                  try {
                    return (
                      sessionStorage.getItem("vera-selected-template") ||
                      "atelier"
                    );
                  } catch {
                    return "atelier";
                  }
                })()}
              >
                {config.templates.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <Password
              name="password"
              label={t("كلمة مرور لوحة المتجر", "Store dashboard password")}
            />
          </div>
          <div className="v-actions">
            <Button disabled={busy}>
              {busy ? (
                <LoaderCircle className="v-spin" size={16} />
              ) : (
                <Plus size={16} />
              )}{" "}
              {t("إنشاء متجري", "Create my store")}
            </Button>
            <button
              type="button"
              className="v-text-link"
              onClick={() => setCreate(false)}
            >
              {t("إلغاء", "Cancel")}
            </button>
          </div>
        </form>
      )}
      {billing && (
        <section className="v-panel v-billing-panel">
          <button
            className="v-close"
            onClick={() => setBilling(null)}
            aria-label={t("إغلاق", "Close")}
          >
            <X size={20} />
          </button>
          <h2>
            {t("اشتراك ", "Subscription · ")}
            {billing.name}
          </h2>
          <p>
            {t(
              "إيقاف المتجر مؤقتًا لا يوقف التجديد. يمكنك إلغاء التجديد من هنا.",
              "Pausing your store does not stop renewal. Manage renewal here.",
            )}
          </p>
          {!config.billingReady ? (
            <p className="v-notice">
              {t(
                "الدفع لم يُفعّل بعد. التجربة المجانية متاحة لحسابك.",
                "Payments are not enabled yet. Your account can use its free trial.",
              )}
            </p>
          ) : config.billingProvider === "paymob" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                billingAction(
                  "checkout",
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
              }}
            >
              <p>
                {t("التحصيل الفعلي: ", "Billing total: ")}
                {config.plan &&
                  new Intl.NumberFormat("en", {
                    style: "currency",
                    currency: config.plan.currency,
                  }).format(config.plan.amount / 100)}{" "}
                / {t("٣٠ يومًا", "30 days")}
              </p>
              <div className="v-form-grid">
                <label className="v-field">
                  {t("الاسم الأول", "First name")}
                  <input name="firstName" required maxLength={50} />
                </label>
                <label className="v-field">
                  {t("اسم العائلة", "Last name")}
                  <input name="lastName" required maxLength={50} />
                </label>
                <label className="v-field">
                  {t("رقم الهاتف الدولي", "Phone with country code")}
                  <input
                    name="phone"
                    type="tel"
                    required
                    pattern="\+[0-9]{8,15}"
                    placeholder="+201000000000"
                    dir="ltr"
                  />
                </label>
              </div>
              <label className="v-consent">
                <input type="checkbox" required />
                {t(
                  "أوافق على التجديد التلقائي بالمبلغ المعروض كل ٣٠ يومًا حتى الإلغاء.",
                  "I agree to automatic renewal at the displayed amount every 30 days until cancellation.",
                )}
              </label>
              <div className="v-actions">
                <Button disabled={busy}>
                  {t("الدفع عبر Paymob", "Continue to Paymob")}
                </Button>
                <button
                  type="button"
                  className="v-text-link"
                  disabled={busy}
                  onClick={() => billingAction("cancel-subscription")}
                >
                  {t("إلغاء التجديد", "Cancel renewal")}
                </button>
              </div>
            </form>
          ) : (
            <div className="v-actions">
              <Button disabled={busy} onClick={() => billingAction("checkout")}>
                {t("تفعيل الاشتراك", "Subscribe")}
              </Button>
              <button
                className="v-text-link"
                disabled={busy}
                onClick={() => billingAction("billing")}
              >
                {t("إدارة الفواتير والتجديد", "Manage invoices & renewal")}
              </button>
            </div>
          )}
        </section>
      )}
      {stores === null ? (
        <p className="v-loading">
          {t("جاري تحميل متاجرك…", "Loading your stores…")}
        </p>
      ) : stores.length ? (
        <div className="v-stores">
          {stores.map((store) => (
            <StoreCard
              key={store.id}
              store={store}
              onRefresh={() => setRefresh((x) => x + 1)}
              onAction={setBilling}
            />
          ))}
        </div>
      ) : (
        <section className="v-empty">
          <Store strokeWidth={1} />
          <h2>{t("متجرك الأول يبدأ هنا.", "Your first store starts here.")}</h2>
          <p>
            {t(
              "اختر GALA أو أتيليه أو FORM، وأضف التفاصيل التي تجعله لك.",
              "Choose GALA, The Atelier or FORM. Add the details that make it yours.",
            )}
          </p>
          <Button onClick={() => setCreate(true)}>
            {t("أنشئ أول متجر", "Create your first store")}
          </Button>
        </section>
      )}
      <div className="v-workspace-bottom">
        <section className="v-panel">
          <span className="v-eyebrow">YOUR ACCOUNT</span>
          <h2>{t("حسابك", "Your account")}</h2>
          <p>{config.user.name}</p>
          <p dir="ltr">{config.user.email}</p>
          <span className="v-security">
            <ShieldCheck size={16} />
            {t("متصل بحساب Google", "Connected with Google")}
          </span>
        </section>
        <section className="v-panel">
          <span className="v-eyebrow">BILLING HISTORY</span>
          <h2>{t("سجل المدفوعات", "Payment history")}</h2>
          {invoices.length ? (
            invoices.map((i) => (
              <div className="v-invoice" key={i.id}>
                <span>
                  {i.store}
                  <small>
                    {new Date(i.created).toLocaleDateString()} ·{" "}
                    {statusLabel(i.status, t)}
                  </small>
                </span>
                <strong>
                  {new Intl.NumberFormat("en", {
                    style: "currency",
                    currency: i.currency,
                  }).format(i.amount / 100)}
                </strong>
                {i.url && (
                  <a href={i.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            ))
          ) : (
            <p>{t("لا توجد مدفوعات حتى الآن.", "No payments yet.")}</p>
          )}
        </section>
      </div>
    </main>
  );
}
function Owner({ config }) {
  const t = useCopy();
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [page, setPage] = useState(0),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (config.user?.isOwner)
      request("/owner?page=" + page)
        .then(setData)
        .catch((e) => setError(e.message));
  }, [config.user, page, refresh]);
  if (!config.user) return <Login config={config} />;
  if (!config.user.isOwner)
    return (
      <main className="v-workspace">
        <h1>
          {t(
            "هذه المساحة مخصصة للمالك.",
            "This space is for the platform owner.",
          )}
        </h1>
        <Button to="/workspace">
          {t("العودة لمساحتي", "Back to workspace")}
        </Button>
      </main>
    );
  return (
    <main className="v-workspace">
      <div className="v-page-heading">
        <div>
          <span className="v-eyebrow">VÉRA / OWNER STUDIO</span>
          <h1>{t("الصورة الكاملة.", "The complete picture.")}</h1>
          <p>
            {t(
              "المستخدمون والمتاجر والنشاط، في مساحة واحدة.",
              "People, stores, and activity, together.",
            )}
          </p>
        </div>
        <Button onClick={() => setRefresh((x) => x + 1)}>
          {t("تحديث", "Refresh")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="v-alert">
          {error}
        </p>
      )}
      {data ? (
        <>
          <OwnerSettings request={request} />
          <div className="v-metrics">
            {[
              [data.counts.users, t("الحسابات", "Accounts")],
              [data.counts.stores, t("المتاجر", "Stores")],
              [data.counts.active, t("المتاجر المتاحة", "Available stores")],
            ].map(([n, label]) => (
              <div className="v-panel" key={label}>
                <span>{label}</span>
                <strong>{n}</strong>
              </div>
            ))}
          </div>
          <section className="v-panel">
            <h2>{t("المتاجر", "Stores")}</h2>
            <div className="v-table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      t("المتجر", "Store"),
                      t("المالك", "Owner"),
                      t("الطلبات / الزيارات", "Orders / visits"),
                      t("الاشتراك", "Billing"),
                      t("التحكم", "Control"),
                    ].map((x) => (
                      <th key={x}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.stores.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.name} ↗
                        </a>
                        <small>{s.slug}</small>
                      </td>
                      <td>{s.email}</td>
                      <td>
                        {s.orders} / {s.visits}
                      </td>
                      <td>
                        {statusLabel(s.billingStatus, t)}
                        <small>
                          {s.available
                            ? t("متاح", "Available")
                            : t("غير متاح", "Unavailable")}
                        </small>
                      </td>
                      <td>
                        <button
                          className="v-text-link"
                          onClick={async () => {
                            try {
                              await request("/owner/stores/" + s.id, "PATCH", {
                                suspended: !s.suspended,
                              });
                              setRefresh((x) => x + 1);
                            } catch (e) {
                              setError(e.message);
                            }
                          }}
                        >
                          {s.suspended
                            ? t("رفع الإيقاف", "Restore")
                            : t("إيقاف إداري", "Suspend")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="v-actions">
              <button
                disabled={page === 0}
                onClick={() => setPage((x) => x - 1)}
              >
                {t("السابق", "Previous")}
              </button>
              <span>{page + 1}</span>
              <button
                disabled={data.stores.length < 50 && data.users.length < 50}
                onClick={() => setPage((x) => x + 1)}
              >
                {t("التالي", "Next")}
              </button>
            </div>
          </section>
          <div className="v-workspace-bottom">
            <section className="v-panel">
              <h2>{t("العملاء", "Customers")}</h2>
              {data.users.map((u) => (
                <div className="v-activity" key={u.id}>
                  <strong>{u.name}</strong>
                  <span>{u.email}</span>
                  <small>
                    {u.stores} {t("متاجر", "stores")}
                  </small>
                </div>
              ))}
            </section>
            <section className="v-panel">
              <h2>{t("آخر النشاطات", "Recent activity")}</h2>
              {data.activity.map((a) => (
                <div className="v-activity" key={a.id}>
                  <strong>{actionLabel(a.action, t)}</strong>
                  <span>
                    {a.email || "System"}
                    {a.store_id ? " · #" + a.store_id : ""}
                  </span>
                  <small>{new Date(a.at).toLocaleString()}</small>
                </div>
              ))}
            </section>
          </div>
        </>
      ) : (
        <p>{t("جاري التحميل…", "Loading…")}</p>
      )}
    </main>
  );
}
function Legal({ privacy, config }) {
  const t = useCopy();
  return (
    <main className="v-legal">
      <span className="v-eyebrow">VÉRA / {privacy ? "PRIVACY" : "TERMS"}</span>
      <h1>
        {privacy
          ? t("سياسة الخصوصية", "Privacy policy")
          : t("شروط الخدمة", "Terms of service")}
      </h1>
      <p>{t("آخر تحديث: أكتوبر ٢٠٢٦", "Last updated: October 2026")}</p>
      {(privacy
        ? [
            [
              t("البيانات التي نستخدمها", "Data we use"),
              t(
                "نستخدم معرّف حساب Google واسمك وبريدك الإلكتروني لتسجيل الدخول وإدارة حسابك. نخزن إعدادات متاجرك ومنتجاتها وطلباتها وبيانات العملاء التي تجمعها أنت.",
                "We use your Google account ID, name, and email to sign you in and manage your account. We store your store settings, products, orders, and the customer data you collect.",
              ),
            ],
            [
              t("الدفع والحماية", "Payments and security"),
              t(
                "تُدخل بيانات البطاقة لدى بوابة الدفع. لا نخزن أرقام البطاقات. تُحفظ كلمات مرور لوحات المتاجر كقيم hash، وتُشفّر بيانات تكامل الإشعارات.",
                "You enter card details at the payment provider. We do not store card numbers. Store passwords are hashed and notification integration credentials are encrypted.",
              ),
            ],
            [
              t("ملفات الارتباط والتحليلات", "Cookies and analytics"),
              t(
                "نستخدم ملفات ارتباط لازمة للجلسات وتفضيل اللغة. يسجل المتجر زياراته وأحداث التسوق، ويحترم إعدادات Do Not Track وGlobal Privacy Control.",
                "We use essential session cookies and language preferences. Stores record visits and shopping events, respecting Do Not Track and Global Privacy Control.",
              ),
            ],
            [
              t("طلبات البيانات", "Data requests"),
              t(
                "لطلب الوصول لبياناتك أو حذف حسابك، تواصل مع دعم المنصة. أنت مسؤول عن سياسات خصوصية متجرك وطريقة استخدام بيانات زبائنك.",
                "Contact platform support to request access to your data or account deletion. You are responsible for your store privacy policy and your use of customer data.",
              ),
            ],
          ]
        : [
            [
              t("التجربة والاشتراك", "Trial and subscription"),
              t(
                "التجربة المجانية ١٤ يومًا من إنشاء الحساب. الاشتراك لكل متجر. تُعرض عملة التحصيل والمبلغ قبل الدفع. تتطلب الواجهة العامة تجربة سارية أو اشتراكًا نشطًا.",
                "Your free trial lasts 14 days from account creation. Subscriptions are per store. The billing currency and amount are displayed before payment. Your public storefront requires a current trial or active subscription.",
              ),
            ],
            [
              t("التجديد والإلغاء", "Renewal and cancellation"),
              t(
                "يتجدد الاشتراك وفق الفترة المعروضة عند الدفع حتى تلغي التجديد. إيقاف واجهة المتجر لا يلغي الاشتراك. تبقى صلاحية الفترة المدفوعة حتى نهايتها عند إلغاء التجديد.",
                "Subscriptions renew on the schedule shown at checkout until canceled. Pausing a storefront does not cancel billing. Canceling renewal retains access through the paid period.",
              ),
            ],
            [
              t("متجرك ومسؤوليتك", "Your store and responsibilities"),
              t(
                "أنت مسؤول عن المنتجات والمحتوى والتسعير والتوصيل وسياسات الاسترجاع. لا تستخدم المنصة في نشاط غير قانوني. احمِ بيانات الدخول ولا تشاركها مع غير المصرح لهم.",
                "You are responsible for products, content, pricing, delivery, and returns. Do not use the platform for unlawful activity. Protect your access credentials and share them only with authorized people.",
              ),
            ],
            [
              t("التواصل", "Contact"),
              t(
                "للاستفسارات أو طلبات الاسترداد، تواصل مع دعم المنصة. تخضع طلبات الاسترداد للقانون المطبق وظروف الطلب.",
                "Contact platform support for questions or refund requests. Refund requests are handled under applicable law and the circumstances of the request.",
              ),
            ],
          ]
      ).map(([title, text]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{text}</p>
        </section>
      ))}
      {config.supportEmail && (
        <a href={"mailto:" + config.supportEmail}>{config.supportEmail}</a>
      )}
    </main>
  );
}
function DesignSystem() {
  const t = useCopy();
  return (
    <main className="v-workspace">
      <span className="v-eyebrow">VÉRA / DESIGN SYSTEM</span>
      <h1>
        {t("هوية متناسقة، في كل تفصيلة.", "One identity, in every detail.")}
      </h1>
      <div className="v-swatches">
        {[
          ["Canvas", "#F2F1EF"],
          ["Primary", "#743F37"],
          ["Gold", "#B49473"],
          ["Ink", "#4A3A33"],
          ["Muted", "#737365"],
          ["Highlight", "#F0E4AF"],
          ["White", "#FFFFFF"],
        ].map(([name, color]) => (
          <article className="v-panel" key={name}>
            <div style={{ background: color }} />
            <strong>{name}</strong>
            <code>{color}</code>
          </article>
        ))}
      </div>
      <section className="v-panel">
        <Mark large />
        <h2>
          {t("حروف تحكي عن علامتك.", "Beautifully considered typography.")}
        </h2>
        <p>Playfair Display · Raleway · Amiri · Tajawal</p>
        <div className="v-actions">
          <Button>{t("زر أساسي", "Primary action")}</Button>
          <a
            href="/platform/assets/vera-mark.svg"
            className="v-text-link"
            download
          >
            {t("تحميل الشعار SVG", "Download SVG logo")}
          </a>
          <a href="/platform/vera-profile.png" className="v-text-link" download>
            {t("صورة البروفايل", "Profile image")}
          </a>
        </div>
      </section>
    </main>
  );
}
export default function Platform({ initialConfig }) {
  const [config, setConfig] = useState(initialConfig),
    [error, setError] = useState("");
  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      requestAnimationFrame(() =>
        document.getElementById(location.hash.slice(1))?.scrollIntoView(),
      );
    } else window.scrollTo(0, 0);
    document.title =
      "VÉRA — " +
      (document.documentElement.lang === "ar"
        ? "مساحة تليق بعلامتك"
        : "A home for your brand");
  }, [location]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const nodes = document.querySelectorAll(
      ".v-intro,.v-section-heading,.v-template,.v-steps article,.v-control>div",
    );
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("v-revealed");
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.08 },
    );
    nodes.forEach((n) => {
      n.classList.add("v-reveal");
      observer.observe(n);
    });
    return () => observer.disconnect();
  }, [location.pathname]);
  async function logout() {
    try {
      await request("/logout", "POST", {});
      setConfig({ ...config, user: null });
      window.location.assign("/");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="v-shell">
      <a href="#v-main" className="v-skip">
        Skip to content / المحتوى
      </a>
      <Header user={config.user} onLogout={logout} />
      {error && (
        <p className="v-alert" role="alert">
          {error}
        </p>
      )}
      <div id="v-main">
        <Routes>
          <Route path="/" element={<Home config={config} />} />
          <Route
            path="/templates"
            element={
              <main className="v-section v-gallery">
                <div className="v-section-heading">
                  <span className="v-eyebrow">THE TEMPLATE COLLECTION</span>
                  <h1>GALA. The Atelier. FORM.</h1>
                </div>
                {config.templates.map((x) => (
                  <TemplateCard template={x} key={x.id} />
                ))}
              </main>
            }
          />
          <Route path="/login" element={<Login config={config} />} />
          <Route path="/workspace" element={<Workspace config={config} />} />
          <Route path="/owner" element={<Owner config={config} />} />
          <Route path="/privacy" element={<Legal privacy config={config} />} />
          <Route path="/terms" element={<Legal config={config} />} />
          <Route path="/design-system" element={<DesignSystem />} />
        </Routes>
      </div>
      <Footer config={config} />
    </div>
  );
}
