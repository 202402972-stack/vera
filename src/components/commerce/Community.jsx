import React, { useState } from "react";
import { api, jsonRequest } from "@/api/store";
import { useLanguage } from "@/i18n/LanguageContext";
export default function Community({ newsletter = false }) {
  const { language } = useLanguage(),
    t = (ar, en) => (language === "ar" ? ar : en),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="community-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const form = e.currentTarget;
        try {
          const body = Object.fromEntries(new FormData(form));
          await api(
            newsletter ? "/newsletter" : "/contact",
            jsonRequest("POST", { ...body, consent: body.consent === "on" }),
          );
          setMessage(
            newsletter
              ? t(
                  "حُفظ اشتراكك في النشرة.",
                  "Your newsletter subscription was saved.",
                )
              : t("وصلت رسالتك إلى المتجر.", "Your message reached the store."),
          );
          form.reset();
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>
        {newsletter
          ? t("ابقَ على تواصل", "Keep in touch")
          : t("تواصل مع المتجر", "Contact the store")}
      </h2>
      {!newsletter && (
        <label>
          {t("الاسم", "Name")}
          <input name="name" required maxLength={120} />
        </label>
      )}
      <label>
        {t("البريد", "Email")}
        <input name="email" type="email" required maxLength={200} />
      </label>
      {newsletter ? (
        <label>
          <input name="consent" type="checkbox" required />
          {t(
            "أوافق على استلام أخبار المتجر",
            "I agree to receive store updates",
          )}
        </label>
      ) : (
        <label>
          {t("الرسالة", "Message")}
          <textarea name="body" required maxLength={4000} />
        </label>
      )}
      <button disabled={busy}>
        {newsletter ? t("اشتراك", "Subscribe") : t("إرسال", "Send")}
      </button>
      {error && <p role="alert">{error}</p>}
      <p role="status">{message}</p>
    </form>
  );
}
