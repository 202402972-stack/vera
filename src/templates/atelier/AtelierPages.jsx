import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getProducts, api } from "@/api/store";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useSaved } from "@/templates/form/FormShell";
import { useLanguage } from "@/i18n/LanguageContext";
import Collections from "@/components/commerce/Collections";
import RetailAccount from "@/templates/form/RetailAccount";
import Community from "@/components/commerce/Community";
import "./atelier.css";
import { useStore } from "@/hooks/useStore";
export function AtelierPage({ children }) {
  return (
    <div className="atelier-store">
      <Header />
      <main id="main-content">{children}</main>
      <Footer />
    </div>
  );
}
export function AtelierCatalog({ saved = false }) {
  const { language } = useLanguage(),
    t = (ar, en) => (language === "ar" ? ar : en),
    [params, setParams] = useSearchParams(),
    { ids, toggle } = useSaved(),
    [data, setData] = useState(null),
    [collections, setCollections] = useState([]),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    getProducts(
      saved
        ? { ids: ids.length ? ids : ["__none__"], signal: c.signal }
        : { ...Object.fromEntries(params), signal: c.signal },
    )
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => c.abort();
  }, [params, ids, saved, language]);
  useEffect(() => {
    api("/collections")
      .then((r) => setCollections(r.collections))
      .catch((e) => setError(e.message));
  }, []);
  const change = (key, value) => {
    const next = new URLSearchParams(params);
    if (key !== "offset") next.delete("offset");
    value ? next.set(key, value) : next.delete(key);
    setParams(next);
  };
  return (
    <AtelierPage>
      <section className="atelier-catalog">
        <span>THE ATELIER / {t("قطع لها حكاية", "Considered pieces")}</span>
        <h1>
          {saved
            ? t("قطعك المحفوظة", "Your saved pieces")
            : t("المجموعة", "The collection")}
        </h1>
        {!saved && (
          <div className="atelier-catalog-tools">
            <input
              aria-label={t("بحث المنتجات", "Search products")}
              placeholder={t(
                "ابحث عن قطعة أو خامة",
                "Search pieces or materials",
              )}
              value={params.get("search") || ""}
              onChange={(e) => change("search", e.target.value)}
            />
            <select
              aria-label={t("المجموعة", "Collection")}
              value={params.get("collection") || ""}
              onChange={(e) => change("collection", e.target.value)}
            >
              <option value="">{t("كل المجموعات", "All collections")}</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {language === "ar" ? c.nameAr || c.name : c.name}
                </option>
              ))}
            </select>
            <select
              aria-label={t("ترتيب", "Sort")}
              value={params.get("sort") || "featured"}
              onChange={(e) => change("sort", e.target.value)}
            >
              <option value="featured">{t("مختارة", "Featured")}</option>
              <option value="newest">{t("الأحدث", "Newest")}</option>
              <option value="price-asc">
                {t("السعر من الأقل", "Price: low to high")}
              </option>
            </select>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        {!data && !error && <p role="status">…</p>}
        {data?.total === 0 && (
          <p>
            {t(
              "لم نجد قطعًا مطابقة؛ جرّب بحثًا آخر.",
              "No matching pieces; try another search.",
            )}
          </p>
        )}
        <div className="atelier-grid">
          {data?.products.map((p) => (
            <article key={p.id}>
              <Link to={"/product/" + p.id}>
                <img src={p.image} alt={p.title} loading="lazy" />
                <h2>{p.title}</h2>
                <p>{p.price_formatted}</p>
              </Link>
              <button
                aria-pressed={ids.includes(p.id)}
                onClick={() => toggle(p.id)}
                aria-label={t("حفظ القطعة", "Save piece")}
              >
                {ids.includes(p.id) ? "♥" : "♡"}
              </button>
            </article>
          ))}
        </div>
        <nav className="atelier-catalog-tools">
          <button
            disabled={!Number(params.get("offset"))}
            onClick={() =>
              change(
                "offset",
                String(Math.max(0, (Number(params.get("offset")) || 0) - 24)),
              )
            }
          >
            {t("السابق", "Previous")}
          </button>
          <span>
            {data?.total} {t("قطعة", "pieces")}
          </span>
          <button
            disabled={
              !data || (Number(params.get("offset")) || 0) + 24 >= data.total
            }
            onClick={() =>
              change("offset", String((Number(params.get("offset")) || 0) + 24))
            }
          >
            {t("التالي", "Next")}
          </button>
        </nav>
      </section>
    </AtelierPage>
  );
}
export function AtelierCollections() {
  return (
    <AtelierPage>
      <Collections />
    </AtelierPage>
  );
}
export function AtelierAccount() {
  return (
    <AtelierPage>
      <div className="atelier-retail">
        <RetailAccount />
      </div>
    </AtelierPage>
  );
}
export function AtelierContact() {
  const { language } = useLanguage(),
    { store } = useStore();
  return (
    <AtelierPage>
      <section className="atelier-catalog">
        <h1>{language === "ar" ? "تواصل معنا" : "Contact"}</h1>
        {store.footer.email && (
          <a href={"mailto:" + store.footer.email}>{store.footer.email}</a>
        )}
        {store.footer.location && <p>{store.footer.location}</p>}
        <Community />
      </section>
    </AtelierPage>
  );
}
