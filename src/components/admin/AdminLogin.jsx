import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  Globe,
  LockKeyhole,
  Loader2,
} from "lucide-react";
import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Notice } from "./AdminUI";

export default function AdminLogin({
  store,
  password,
  setPassword,
  busy,
  error,
  onSubmit,
}) {
  const { t, language, setLanguage } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  return localizeView(
    <main className="studio-login">
      <section className="login-editorial" aria-label={store.name}>
        <img src={store.hero.image} alt="" className="login-art" />
        <div className="login-editorial-top">
          <span
            className="login-monogram"
            dir="ltr"
            lang="en"
            aria-hidden="true"
          >
            {store._template?.renderer === "form" ? "V" : "B"}
          </span>
          <span>{store.name}</span>
        </div>
        <div className="login-editorial-copy">
          <p className="login-eyebrow">THE MERCHANT STUDIO</p>
          <h2>Every detail, thoughtfully managed.</h2>
          <p>Your collection. Your identity. Your next chapter.</p>
        </div>
        <span className="login-edition" dir="ltr" lang="en">
          {store._template?.renderer === "form"
            ? "VÉRA — MERCHANT STUDIO"
            : "BOUTIQUE — MADE WITH CARE"}
        </span>
      </section>
      <section className="login-workspace">
        <div className="login-topbar">
          <Link to="/">
            <ArrowLeft size={15} />{" "}
            {store._template?.renderer === "form"
              ? "View store"
              : "Back to boutique"}
          </Link>
          <button
            type="button"
            className="dashboard-language"
            aria-label={
              language === "ar" ? "Switch to English" : "التبديل إلى العربية"
            }
            onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
          >
            <Globe size={15} />
            {language === "ar" ? "English" : "العربية"}
          </button>
        </div>
        <motion.div
          className="login-form-wrap"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <span className="login-form-icon">
            <LockKeyhole size={22} strokeWidth={1.5} />
          </span>
          <p className="admin-section-label">Store management</p>
          <h1>Welcome to your studio.</h1>
          <p className="login-intro">
            Use your private dashboard password to continue.
          </p>
          <form onSubmit={onSubmit}>
            {error && <Notice error>{error}</Notice>}
            <label
              className="login-password-label"
              htmlFor="dashboard-password"
            >
              Dashboard password
            </label>
            <div className="login-password-field">
              <input
                id="dashboard-password"
                type={visible ? "text" : "password"}
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                maxLength={500}
                required
                autoFocus
                disabled={busy}
                aria-describedby={capsLock ? "caps-lock-hint" : undefined}
                onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                onBlur={() => setCapsLock(false)}
              />
              <button
                type="button"
                className="login-password-toggle"
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
                onClick={() => setVisible((v) => !v)}
              >
                {visible ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            {capsLock && (
              <p id="caps-lock-hint" className="login-caps" role="status">
                Caps Lock is on.
              </p>
            )}
            <Button
              type="submit"
              disabled={busy}
              className="login-submit w-full"
            >
              <span>Enter dashboard</span>
              {busy ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <ArrowUpRight size={17} />
              )}
            </Button>
          </form>
          <p className="login-private">
            <LockKeyhole size={12} /> Private access{" "}
            <span aria-hidden="true">·</span> {store.name}
          </p>
        </motion.div>
        <p className="login-footnote">A quiet space to care for your store.</p>
      </section>
    </main>,
    t,
  );
}
