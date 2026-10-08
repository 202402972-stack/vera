import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useStore } from "@/hooks/useStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { api, getProducts } from "@/api/store";
import { storeKey, storeBase } from "@/lib/store-scope";
const Context = createContext();
export function GalaProvider({ children }) {
  const { store, baseStore } = useStore(),
    { language } = useLanguage();
  const [products, setProducts] = useState([]),
    [collections, setCollections] = useState([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [cartOpen, setCartOpen] = useState(false),
    [rates, setRates] = useState(null);
  const [currency, setCurrency] = useState(() => {
    try {
      return (
        localStorage.getItem(storeKey("gala-currency")) ||
        store.checkout.currency
      );
    } catch {
      return store.checkout.currency;
    }
  });
  const selectedIds = JSON.stringify([
    ...new Set([
      ...(baseStore.gala.trendingIds || []),
      ...(baseStore.gala.lookbookIds || []),
    ]),
  ]);
  const reload = useCallback(() => {
    setLoading(true);
    return Promise.all([getProducts({ limit: 100 }), api("/collections")])
      .then(async ([p, c]) => {
        const missing = JSON.parse(selectedIds).filter(
          (id) => !p.products.some((x) => x.id === id),
        );
        const batches = [];
        for (let i = 0; i < missing.length; i += 100)
          batches.push(getProducts({ ids: missing.slice(i, i + 100) }));
        const extra = await Promise.all(batches);
        setProducts([...p.products, ...extra.flatMap((r) => r.products)]);
        setCollections(c.collections);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedIds]);
  useEffect(() => {
    reload();
  }, [reload, language]);
  useEffect(() => {
    let active = true;
    api("/currency-rates")
      .then((r) => {
        if (active) setRates(r);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [store.checkout.currency]);
  const config = baseStore.gala;
  const pick = (v) =>
    typeof v === "object" ? v?.[language] || v?.en || "" : v || "";
  const t = (en, ar) => (language === "ar" ? ar : en);
  const effectiveCurrency =
    config.currency.codes.includes(currency) &&
    rates?.base === store.checkout.currency &&
    rates?.rates[currency]
      ? currency
      : store.checkout.currency;
  const money = (cents) =>
    new Intl.NumberFormat(language === "ar" ? "ar-u-nu-latn" : "en", {
      style: "currency",
      currency: effectiveCurrency,
    }).format(
      (cents / 100) *
        (effectiveCurrency === store.checkout.currency
          ? 1
          : rates.rates[effectiveCurrency]),
    );
  const changeCurrency = (c) => {
    setCurrency(c);
    try {
      localStorage.setItem(storeKey("gala-currency"), c);
    } catch {}
  };
  const includeProducts = useCallback(
    (items) =>
      setProducts((prev) =>
        Array.from(new Map([...prev, ...items].map((p) => [p.id, p])).values()),
      ),
    [],
  );
  return (
    <Context.Provider
      value={{
        store,
        config,
        products,
        collections,
        error,
        loading,
        reload,
        includeProducts,
        pick,
        t,
        language,
        money,
        currency: effectiveCurrency,
        setCurrency: changeCurrency,
        rates,
        cartOpen,
        setCartOpen,
        preview: storeBase.startsWith("/demo/"),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useGala = () => useContext(Context);
export function useDialog(open, ref, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = ref.current;
    if (!node) {
      document.body.style.overflow = overflow;
      return;
    }
    const focus = () =>
      node
        ?.querySelector('button,input,a,select,textarea,[tabindex="0"]')
        ?.focus();
    focus();
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const list = [
          ...node.querySelectorAll(
            'button:not([disabled]),a[href],input,select,textarea,[tabindex="0"]',
          ),
        ].filter((n) => n.getClientRects().length);
        const first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, [open, ref]);
}
