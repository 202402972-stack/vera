import "@/motion.css";

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  Menu,
  X,
  Globe2,
  ExternalLink,
  LogOut,
  Eye,
  EyeOff,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import "./platform.css";
const assets = "/platform/assets/";
export function useCopy() {
  const { language } = useLanguage();
  return (ar, en) => (language === "ar" ? ar : en);
}
export function statusLabel(value, t) {
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
    draft: ["مسودة", "Draft"],
    published: ["منشور", "Published"],
    queued: ["في الانتظار", "Queued"],
    detecting: ["كشف المصدر", "Detecting source"],
    scanning: ["قراءة المصدر", "Reading source"],
    awaiting_review: ["يحتاج مراجعة", "Review required"],
    importing: ["جارٍ النقل", "Importing"],
    ready: ["مكتمل", "Completed"],
    partial: ["مكتمل جزئيًا", "Partially completed"],
    review: ["للمراجعة", "To review"],
    imported: ["نُقل", "Imported"],
    paused: ["متوقف مؤقتًا", "Paused"],
  };
  return labels[value] ? t(...labels[value]) : value;
}
export function actionLabel(value, t) {
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
export function Mark({ large = false }) {
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
export function Button({ children, to, ...props }) {
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
export function Password({ name, label, minLength = 12 }) {
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
export function Header({ user, onLogout }) {
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
export function Footer({ config }) {
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
export function TemplateCard({ template }) {
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
