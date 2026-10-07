import React, {
  createContext,
  useContext,
  useState,
  useLayoutEffect,
  useEffect,
} from "react";
import { translations, translate } from "./translations";
const Context = createContext(null);
let currentLanguage = "ar";
export const getLanguage = () => currentLanguage;
export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem("store-language") === "en" ? "en" : "ar";
    } catch {
      return "ar";
    }
  });
  currentLanguage = language;
  useLayoutEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem("store-language", language);
    } catch {}
  }, [language]);
  useEffect(() => {
    const listener = (e) => {
      if (e.key === "store-language" && ["en", "ar"].includes(e.newValue))
        setLanguage(e.newValue);
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);
  const value = {
    language,
    setLanguage,
    t: (text) => translate(text, language),
    date: (value, options) =>
      new Intl.DateTimeFormat(
        language === "ar" ? "ar-u-nu-latn" : "en-US",
        options || { dateStyle: "medium", timeStyle: "short" },
      ).format(new Date(value)),
    number: (value) =>
      Number(value || 0).toLocaleString(
        language === "ar" ? "ar-u-nu-latn" : "en-US",
      ),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useLanguage() {
  return (
    useContext(Context) || {
      language: "en",
      setLanguage: () => {},
      t: (v) => v,
      date: (v) => new Date(v).toLocaleString(),
      number: (v) => Number(v).toLocaleString(),
    }
  );
}
const translatedProps = new Set([
  "label",
  "hint",
  "title",
  "subtitle",
  "placeholder",
  "aria-label",
  "alt",
  "note",
]);
// A pure React render helper. Values, IDs, event handlers and API data are untouched.
export function localizeView(node, t) {
  if (typeof node === "string") return t(node);
  if (Array.isArray(node)) return node.map((child) => localizeView(child, t));
  if (!React.isValidElement(node)) return node;
  const props = {};
  for (const key of translatedProps)
    if (typeof node.props[key] === "string") props[key] = t(node.props[key]);
  if (node.props.children !== undefined)
    props.children = localizeView(node.props.children, t);
  return React.cloneElement(node, props);
}
export function LanguageToggle({ className = "" }) {
  const { language, setLanguage } = useLanguage();
  return (
    <button
      type="button"
      className={`language-toggle ${className}`}
      onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
      aria-label={
        language === "ar" ? "Switch to English" : "التبديل إلى العربية"
      }
      lang={language === "ar" ? "en" : "ar"}
      dir="auto"
    >
      {language === "ar" ? "English" : "العربية"}
    </button>
  );
}
