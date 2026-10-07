import { brandTokens } from "@/lib/brand";
import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/api/store";
import { useLanguage } from "@/i18n/LanguageContext";
import { localizeSettings } from "@/i18n/content";
import { defaultSettings } from "@/data/settings";
const StoreContext = createContext();
export function StoreProvider({ children }) {
  const { language } = useLanguage();
  const [baseStore, setStore] = useState(defaultSettings);
  const store = localizeSettings(baseStore, language);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true),
    [ready, setReady] = useState(false);
  const refresh = async () => {
    setLoading(true);
    try {
      setStore(await api(window.location.pathname.endsWith("/admin") ? "/admin/bootstrap" : "/store"));
      setError("");
      setReady(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const tokens = brandTokens(baseStore.brand);
    for (const [key, value] of Object.entries(tokens))
      document.documentElement.style.setProperty(key, value);
  }, [baseStore.brand]);
  useEffect(() => {
    refresh();
  }, []);
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
      {children}
    </StoreContext.Provider>
  );
}
export const useStore = () => useContext(StoreContext);
