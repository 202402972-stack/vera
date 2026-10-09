import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { request } from "@/platform/api";
import "./workspace.css";
export default function Onboarding({ config }) {
  const { language } = useLanguage(),
    t = useCallback((ar, en) => (language === "ar" ? ar : en), [language]),
    navigate = useNavigate();
  const [draft, setDraft] = useState(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [available, setAvailable] = useState(null),
    [busy, setBusy] = useState(false);
  const id = useRef(crypto.randomUUID()),
    loaded = useRef(false),
    seed = useRef({
      template:
        new URLSearchParams(window.location.search).get("template") ||
        sessionStorage.getItem("vera-selected-template") ||
        config.templates[0].id,
      language,
    });
  const templates = useRef(config.templates);
  useEffect(() => {
    if (!config.user) return;
    request("/onboarding")
      .then((r) => {
        const explicit = new URLSearchParams(window.location.search).get(
          "template",
        );
        const old = explicit
          ? r.drafts.find((d) => d.data.template === explicit)
          : r.drafts[0];
        if (old) id.current = old.id;
        if (!templates.current.some((x) => x.id === seed.current.template))
          seed.current.template = templates.current[0].id;
        setDraft(
          old?.data || {
            name: "",
            slug: "",
            template: seed.current.template,
            language: seed.current.language,
            country: "",
            currency: "USD",
            business: "",
            step: 1,
          },
        );
        loaded.current = true;
      })
      .catch((e) => setError(e.message));
  }, [config.user]);
  useEffect(() => {
    if (!draft || !loaded.current) return;
    setStatus(t("جارٍ الحفظ…", "Saving…"));
    const timer = setTimeout(
      () =>
        request("/onboarding/" + id.current, "PUT", draft)
          .then(() => setStatus(t("حُفظت المسودة", "Draft saved")))
          .catch((e) => {
            setStatus("");
            setError(e.message);
          }),
      500,
    );
    return () => clearTimeout(timer);
  }, [draft, t]);
  useEffect(() => {
    setAvailable(null);
    if (!draft?.slug) return;
    const c = new AbortController(),
      timer = setTimeout(
        () =>
          request(
            "/slug?slug=" + encodeURIComponent(draft.slug),
            "GET",
            undefined,
            { signal: c.signal },
          )
            .then((r) => setAvailable(r.available))
            .catch((e) => {
              if (e.name !== "AbortError") setError(e.message);
            }),
        300,
      );
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [draft?.slug]);
  if (!config.user)
    return (
      <main className="v-workspace">
        <Link to="/login?intent=create">
          {t("سجّل الدخول للبدء", "Sign in to begin")}
        </Link>
      </main>
    );
  if (!draft)
    return (
      <main className="v-workspace" role={error ? "alert" : "status"}>
        {error || t("جارٍ تحميل المسودة…", "Loading draft…")}
      </main>
    );
  const change = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  return (
    <main className="v-workspace">
      <span className="v-eyebrow">VÉRA / {draft.step} — 3</span>
      <h1>{t("مساحة لفكرتك", "A home for your idea")}</h1>
      <p>
        {t(
          "التجربة ١٤ يومًا من إنشاء حسابك. حتى ٢٠ متجرًا؛ لا نشر دون مراجعتك.",
          "Your 14-day trial starts with your account. Up to 20 stores; publish after your review.",
        )}
      </p>
      <form
        className="v-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          if (draft.step < 3) {
            change("step", draft.step + 1);
            return;
          }
          setBusy(true);
          try {
            await request("/onboarding/" + id.current, "PUT", draft);
            const s = await request(
              "/onboarding/" + id.current + "/commit",
              "POST",
              {},
            );
            navigate(s.workspaceUrl);
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {draft.step === 1 && (
          <div className="v-form-grid">
            <label className="v-field">
              {t("اسم العلامة", "Brand name")}
              <input
                required
                minLength={2}
                maxLength={65}
                value={draft.name}
                onChange={(e) => {
                  change("name", e.target.value);
                  if (!draft.slug)
                    change(
                      "slug",
                      e.target.value
                        .normalize("NFKD")
                        .replace(/[^a-z0-9]+/gi, "-")
                        .toLowerCase()
                        .replace(/^-|-$/g, "") ||
                        "store-" + id.current.slice(0, 8),
                    );
                }}
              />
            </label>
            <label className="v-field">
              {t("عنوان المتجر", "Store address")}
              <input
                required
                dir="ltr"
                pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
                value={draft.slug}
                onChange={(e) => change("slug", e.target.value)}
              />
              <small>
                {available === null
                  ? ""
                  : available
                    ? t("العنوان متاح", "Address available")
                    : t(
                        "اختر عنوانًا متاحًا من ٣–٤٠ حرفًا",
                        "Choose an available address of 3–40 characters",
                      )}
              </small>
            </label>
            <label className="v-field">
              {t("نوع النشاط", "Business type")}
              <input
                value={draft.business}
                maxLength={100}
                onChange={(e) => change("business", e.target.value)}
              />
            </label>
            <label className="v-field">
              {t("بلد البيع", "Selling country")}
              <input
                required
                value={draft.country}
                maxLength={100}
                onChange={(e) => change("country", e.target.value)}
              />
            </label>
            <label className="v-field">
              {t("لغة المحتوى الأساسية", "Primary content language")}
              <select
                value={draft.language}
                onChange={(e) => change("language", e.target.value)}
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="v-field">
              {t("عملة الأسعار", "Price currency")}
              <select
                value={draft.currency}
                onChange={(e) => change("currency", e.target.value)}
              >
                {["USD", "EGP", "EUR", "GBP", "SAR", "AED"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        {draft.step === 2 && (
          <div className="v-stores-grid">
            {config.templates.map((x) => (
              <label className="v-template-choice" key={x.id}>
                <input
                  type="radio"
                  name="template"
                  value={x.id}
                  checked={draft.template === x.id}
                  onChange={() => change("template", x.id)}
                />
                <img src={x.image} alt="" loading="lazy" />
                <h2>{language === "ar" ? x.nameAr : x.name}</h2>
                <p>{language === "ar" ? x.descriptionAr : x.description}</p>
                <a href={"/demo/" + x.id} target="_blank" rel="noreferrer">
                  {t("معاينة القالب", "Preview template")}
                </a>
              </label>
            ))}
          </div>
        )}
        {draft.step === 3 && (
          <>
            <h2>
              {draft.name} · {draft.template.toUpperCase()}
            </h2>
            <p>
              {t(
                "سنجهز مسودة فارغة. أضف الشعار وأول منتج من مساحة المتجر، أو ابدأ بنقل منتجاتك. يمكنك الاستكمال لاحقًا.",
                "We will prepare an empty draft. Add your logo and first product in your workspace, or import products. You can resume later.",
              )}
            </p>
            <p dir="ltr">
              /s/{draft.slug} · {draft.currency} · {draft.country}
            </p>
          </>
        )}
        <div className="v-actions">
          <button
            className="v-button"
            disabled={busy || (draft.step === 1 && !available)}
          >
            {draft.step === 3
              ? t("جهّز المسودة", "Prepare draft")
              : t("التالي", "Next")}
          </button>
          {draft.step > 1 && (
            <button
              type="button"
              onClick={() => change("step", draft.step - 1)}
            >
              {t("السابق", "Back")}
            </button>
          )}
        </div>
        <p role="status">{status}</p>
        {error && (
          <p role="alert" className="v-alert">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
