import LaunchPanel from "./LaunchPanel";
import React, { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useLanguage } from "@/i18n/LanguageContext";
import { StoreProvider } from "@/hooks/useStore";
import { StoreScopeProvider } from "./StoreScope";
import { request } from "@/platform/api";
import "./workspace.css";
const Admin = lazy(() => import("@/pages/AdminPage"));
const GalaAdmin = lazy(() => import("@/templates/gala/GalaAdmin"));
export default function WorkspaceShell({ config }) {
  const { id, section } = useParams(),
    navigate = useNavigate(),
    { language } = useLanguage(),
    t = useCallback((ar, en) => (language === "ar" ? ar : en), [language]);
  const [state, setState] = useState(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setState(null);
    setError("");
    request("/stores")
      .then(async ({ stores }) => {
        const store = stores.find((s) => String(s.id) === id);
        if (!store)
          throw Error(
            "Store not found or access denied / المتجر غير موجود أو غير مصرح",
          );
        await request(`/stores/${id}/admin-entry`, "POST", {});
        if (active) {
          setState({ stores, store });
          localStorage.setItem("vera-last-store", String(store.id));
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [id, revision]);
  if (!config.user)
    return (
      <main className="v-workspace">
        <Link to="/login">{t("سجّل الدخول", "Sign in")}</Link>
      </main>
    );
  return (
    <section className="workspace-shell">
      <Helmet>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <header className="workspace-topbar">
        <Link to="/workspace">VÉRA ← {t("متاجري", "My stores")}</Link>
        {state && (
          <>
            <select
              aria-label={t("تبديل المتجر", "Switch store")}
              value={id}
              onChange={(e) => {
                if (
                  document.querySelector('[data-dirty="true"]') &&
                  !window.confirm(
                    t(
                      "تجاهل التعديلات غير المحفوظة؟",
                      "Discard unsaved changes?",
                    ),
                  )
                )
                  return;
                navigate(`/workspace/stores/${e.target.value}/overview`);
              }}
            >
              {state.stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <span>
              {state.store.publicationState === "draft"
                ? t("مسودة", "Draft")
                : state.store.available
                  ? t("متاح", "Live")
                  : t("غير متاح", "Unavailable")}
            </span>
            <a href={state.store.url} target="_blank" rel="noreferrer">
              {t("زيارة المتجر", "Visit store")}
            </a>
            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  window.location.origin + state.store.url,
                )
              }
            >
              {t("نسخ الرابط", "Copy link")}
            </button>
          </>
        )}
      </header>
      {error ? (
        <div role="alert" className="v-panel">
          {error}
          <button onClick={() => setRevision((n) => n + 1)}>
            {t("إعادة المحاولة", "Retry")}
          </button>
        </div>
      ) : !state ? (
        <p role="status">{t("جارٍ فتح المتجر…", "Opening store…")}</p>
      ) : (
        <StoreScopeProvider key={id} store={state.store}>
          <StoreProvider mode="admin">
            {["overview", "preview"].includes(section) && <LaunchPanel />}
            <Suspense fallback={<p role="status">…</p>}>
              {state.store.template === "gala" ? <GalaAdmin /> : <Admin />}
            </Suspense>
          </StoreProvider>
        </StoreScopeProvider>
      )}
    </section>
  );
}
