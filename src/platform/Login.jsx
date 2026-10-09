import "@/motion.css";

import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

import "./platform.css";

import { useCopy, Mark, Button } from "./PlatformUI";
const assets = "/platform/assets/";
export default function Login({ config }) {
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
          <Button
            to={
              new URLSearchParams(location.search).get("intent") === "import"
                ? "/workspace/import"
                : new URLSearchParams(location.search).get("intent") ===
                    "create"
                  ? "/workspace/new" + location.search
                  : "/workspace"
            }
          >
            {t("افتح مساحتك", "Open your workspace")}
          </Button>
        ) : (
          <a
            aria-disabled={!config.googleReady}
            className={"v-google" + (!config.googleReady ? " disabled" : "")}
            href={
              config.googleReady
                ? "/api/platform/auth/google" +
                  ("?" +
                    new URLSearchParams({
                      intent:
                        new URLSearchParams(location.search).get("intent") ||
                        "workspace",
                      template:
                        new URLSearchParams(location.search).get("template") ||
                        sessionStorage.getItem("vera-selected-template") ||
                        "",
                    }))
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
