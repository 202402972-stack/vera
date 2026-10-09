import "@/motion.css";

import React, { lazy, useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet";

import "./platform.css";
import Home from "./Home";
import Login from "./Login";
import Workspace from "./Workspace";
import { request } from "./api";
export { request } from "./api";
import {
  useCopy,
  Mark,
  Button,
  Header,
  Footer,
  TemplateCard,
} from "./PlatformUI";
const WorkspaceShell = lazy(() => import("@/workspace/WorkspaceShell"));
const Onboarding = lazy(() => import("@/workspace/Onboarding"));
const ImportWizard = lazy(() => import("@/workspace/ImportWizard"));
const OwnerPortal = lazy(() => import("./OwnerPortal"));
const assets = "/platform/assets/";
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
    const refresh = () =>
      request("/config")
        .then(setConfig)
        .catch((e) => setError(e.message));
    window.addEventListener("platform-config-updated", refresh);
    return () => window.removeEventListener("platform-config-updated", refresh);
  }, []);
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
      <Helmet>
        {/^\/(workspace|owner|login)(\/|$)/.test(location.pathname) ? (
          <meta name="robots" content="noindex,nofollow" />
        ) : (
          <link
            rel="canonical"
            href={window.location.origin + location.pathname}
          />
        )}
      </Helmet>
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
          <Route
            path="/workspace/import"
            element={<ImportWizard config={config} />}
          />
          <Route
            path="/workspace/new"
            element={<Onboarding config={config} />}
          />
          <Route
            path="/workspace/stores/:id/:section"
            element={<WorkspaceShell config={config} />}
          />
          <Route path="/owner" element={<OwnerPortal config={config} />} />
          <Route
            path="/owner/:section"
            element={<OwnerPortal config={config} />}
          />
          <Route
            path="/owner/merchants/:merchantId"
            element={<OwnerPortal config={config} />}
          />
          <Route path="/privacy" element={<Legal privacy config={config} />} />
          <Route path="/terms" element={<Legal config={config} />} />
          <Route path="/design-system" element={<DesignSystem />} />
        </Routes>
      </div>
      <Footer config={config} />
    </div>
  );
}
