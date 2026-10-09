import { brandTokens } from "@/lib/brand";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useStoreApi } from "@/workspace/StoreScope";
import { useLanguage } from "@/i18n/LanguageContext";
import { localizeSettings } from "@/i18n/content";
import { defaultSettings } from "@/data/settings";
const StoreContext = createContext();
export function StoreProvider({ children, mode, preview = false }) {
  const api = useStoreApi();
  const { language } = useLanguage();
  const [baseStore, setStore] = useState(defaultSettings);
  const store = localizeSettings(baseStore, language);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true),
    [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStore(
        await api(
          mode === "admin" || window.location.pathname.endsWith("/admin")
            ? "/admin/bootstrap"
            : "/store",
        ),
      );
      setError("");
      setReady(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api, mode]);
  useEffect(() => {
    if (
      new URLSearchParams(window.location.search).get("designPreview") !== "1"
    )
      return;
    const receive = (e) => {
      if (
        e.origin !== window.location.origin ||
        e.source !== window.parent ||
        e.data?.type !== "vera-design-preview" ||
        e.data.version !== 1 ||
        !e.data.settings ||
        typeof e.data.settings.name !== "string" ||
        !e.data.settings.brand
      )
        return;
      setStore(e.data.settings);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  if (!ready)
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center" role={error ? "alert" : "status"}>
          <p className="text-lg mb-5">
            {error
              ? language === "ar"
                ? "تعذّر تحميل المتجر. حاول مجددًا."
                : "We could not load the store. Please try again."
              : language === "ar"
                ? "جارٍ تحضير متجرك…"
                : "Preparing your boutique…"}
          </p>
          {error && (
            <button
              disabled={loading}
              className="px-6 py-3 rounded-lg bg-primary text-primary-foreground"
              onClick={refresh}
            >
              {language === "ar" ? "حاول مجددًا" : "Try again"}
            </button>
          )}
        </div>
      </main>
    );
  return (
    <StoreContext.Provider
      value={{ store, baseStore, setStore, refresh, error }}
    >
      <div
        className="store-theme"
        style={brandTokens(baseStore.brand)}
        data-preview={preview}
      >
        {children}
      </div>
    </StoreContext.Provider>
  );
}
export const useStore = () => useContext(StoreContext);
