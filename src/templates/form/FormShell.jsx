import SearchPanel from "@/components/commerce/SearchPanel";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  Heart,
  ShoppingBag,
  UserRound,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useCart } from "@/hooks/useCart";
import { useLanguage } from "@/i18n/LanguageContext";
import { storeKey } from "@/lib/store-scope";
import { api, jsonRequest } from "@/api/store";
export const useCopy = () => {
  const { language } = useLanguage();
  return (en, ar) => (language === "ar" ? ar : en);
};
const SavedContext = createContext();
export const useSaved = () => useContext(SavedContext);
export function SavedProvider({ children }) {
  const [customerId, setCustomerId] = useState(null),
    [syncError, setSyncError] = useState("");
  const [ids, setIds] = useState(() => {
    try {
      const a = JSON.parse(localStorage.getItem(storeKey("saved")) || "[]");
      return Array.isArray(a)
        ? a.filter((x) => typeof x === "string").slice(0, 100)
        : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storeKey("saved"), JSON.stringify(ids));
    } catch {}
  }, [ids]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const session = await api("/retail/session");
        if (!active) return;
        setCustomerId(session.customer?.id || null);
        if (session.customer) {
          const remote = await api("/retail/saved");
          if (!active) return;
          if (remote.initialized) setIds(remote.ids);
          else {
            let local = [];
            try {
              const saved = JSON.parse(
                localStorage.getItem(storeKey("saved")) || "[]",
              );
              if (Array.isArray(saved))
                local = saved
                  .filter((x) => typeof x === "string")
                  .slice(0, 100);
            } catch {}
            await api("/retail/saved", jsonRequest("PUT", { ids: local }));
            if (active) setIds(local);
          }
        }
      } catch (e) {
        if (active) setSyncError(e.message);
      }
    };
    load();
    window.addEventListener("shopper-session-changed", load);
    return () => {
      active = false;
      window.removeEventListener("shopper-session-changed", load);
    };
  }, []);
  const toggle = async (id) => {
    const next = ids.includes(id)
      ? ids.filter((x) => x !== id)
      : [...ids, id].slice(-100);
    setSyncError("");
    if (customerId)
      try {
        await api("/retail/saved", jsonRequest("PUT", { ids: next }));
      } catch (e) {
        setSyncError(e.message);
        return;
      }
    setIds(next);
  };
  return (
    <SavedContext.Provider value={{ ids, toggle }}>
      {syncError && (
        <p className="form-account-message" role="alert">
          {syncError}
        </p>
      )}
      {children}
    </SavedContext.Provider>
  );
}
export function FormHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { store } = useStore(),
    { cartItems } = useCart(),
    { language, setLanguage } = useLanguage(),
    t = useCopy(),
    location = useLocation(),
    navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <>
      <a className="form-skip" href="#form-main">
        {t("Skip to content", "انتقل للمحتوى")}
      </a>
      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
      <header className="form-header">
        <Link to="/" className="form-wordmark">
          {store.brand.logo ? (
            <img src={store.brand.logo} alt={store.name} />
          ) : (
            store.name
          )}
        </Link>
        <nav
          className={open ? "form-nav is-open" : "form-nav"}
          aria-label={t("Main navigation", "القائمة الرئيسية")}
        >
          <Link to="/shop">{t("Shop", "تسوق")}</Link>
          <Link to="/shop?sort=newest">{t("New arrivals", "وصل حديثًا")}</Link>
          <Link to="/collections">{t("Collections", "المجموعات")}</Link>
          <Link to="/about">{t("Our story", "حكايتنا")}</Link>
          <Link className="form-nav-account" to="/account">
            {t("Account & tracking", "الحساب والتتبع")}
          </Link>
        </nav>
        <form
          className="form-search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/shop?search=${encodeURIComponent(search)}`);
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t("Search products", "ابحث عن منتجات")}
            placeholder={t("Search products, collections…", "ابحث عن منتجات…")}
          />
          <button aria-label={t("Search", "بحث")}>
            <Search size={18} />
          </button>
        </form>
        <div className="form-tools">
          <button
            aria-label={t("Search collection", "بحث المجموعة")}
            onClick={() => setSearchOpen(true)}
          >
            <Search size={20} />
          </button>
          <button
            onClick={() => setLanguage(language === "en" ? "ar" : "en")}
            aria-label={t("Switch to Arabic", "Switch to English")}
          >
            {language === "en" ? "AR" : "EN"}
          </button>
          <Link to="/account" aria-label={t("Account", "حسابي")}>
            <UserRound size={20} />
          </Link>
          <Link to="/saved" aria-label={t("Saved items", "المفضلة")}>
            <Heart size={20} />
          </Link>
          <Link to="/cart" aria-label={t("Shopping bag", "حقيبة التسوق")}>
            <ShoppingBag size={20} />
            <sup>{cartItems.reduce((a, b) => a + b.quantity, 0) || ""}</sup>
          </Link>
          <button
            className="form-menu"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={t("Menu", "القائمة")}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
    </>
  );
}
export function FormFooter() {
  const { store } = useStore(),
    t = useCopy();
  return (
    <footer className="form-footer">
      <div>
        <Link className="form-wordmark" to="/">
          {store.name}
        </Link>
        <p>{store.footer.text}</p>
      </div>
      <div>
        <strong>{t("Explore", "اكتشف")}</strong>
        <Link to="/shop">{t("All products", "كل المنتجات")}</Link>
        <Link to="/saved">{t("Saved items", "المفضلة")}</Link>
        <Link to="/about">{t("Our story", "حكايتنا")}</Link>
      </div>
      <div>
        <strong>{t("Customer care", "خدمة العملاء")}</strong>
        <Link to="/account">{t("Orders & returns", "الطلبات والاسترجاع")}</Link>
        <Link to="/shipping">
          {t("Delivery information", "معلومات التوصيل")}
        </Link>
        <Link to="/returns">{t("Returns policy", "سياسة الاسترجاع")}</Link>
        <Link to="/contact">{t("Contact", "تواصل معنا")}</Link>
      </div>
      <div>
        <strong>{t("Stay connected", "على تواصل")}</strong>
        {store.footer.email && (
          <a href={`mailto:${store.footer.email}`}>{store.footer.email}</a>
        )}
        {store.footer.phone && (
          <a href={`tel:${store.footer.phone}`}>{store.footer.phone}</a>
        )}
        <p>{store.footer.location}</p>
        <Link to="/account">
          {t("Your account", "حسابك")} <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="form-legal">
        <span>
          © {new Date().getFullYear()} {store.name}
        </span>
        <span>
          <Link to="/privacy">{t("Privacy", "الخصوصية")}</Link>
          <Link to="/terms">{t("Terms", "الشروط")}</Link>
        </span>
      </div>
    </footer>
  );
}
