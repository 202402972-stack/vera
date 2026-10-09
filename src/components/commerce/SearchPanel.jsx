import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProducts } from "@/api/store";
import Overlay from "./Overlay";
import { useLanguage } from "@/i18n/LanguageContext";
export default function SearchPanel({ open, onClose }) {
  const { language } = useLanguage(),
    [query, setQuery] = useState(""),
    [items, setItems] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setItems(null);
      return;
    }
    const c = new AbortController(),
      timer = setTimeout(
        () =>
          getProducts({ search: query, limit: 6, signal: c.signal })
            .then((r) => setItems(r.products))
            .catch((e) => {
              if (e.name !== "AbortError") setError(e.message);
            }),
        250,
      );
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [query, open, language]);
  return (
    <Overlay
      open={open}
      onClose={onClose}
      title={language === "ar" ? "ابحث عن قطعة" : "Find a piece"}
    >
      <input
        className="commerce-search-input"
        autoFocus
        aria-label={language === "ar" ? "بحث" : "Search"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={
          language === "ar" ? "الاسم أو الخامة…" : "Name or material…"
        }
      />
      {error && <p role="alert">{error}</p>}
      {items?.length === 0 && (
        <p>
          {language === "ar"
            ? "لا توجد نتائج؛ جرّب اسمًا أو خامة أخرى."
            : "No results; try another name or material."}
        </p>
      )}
      {items?.map((p) => (
        <Link
          className="commerce-search-result"
          key={p.id}
          to={"/product/" + p.id}
          onClick={onClose}
        >
          <img src={p.image} alt="" />
          <span>
            {p.title}
            <small>{p.price_formatted}</small>
          </span>
        </Link>
      ))}
    </Overlay>
  );
}
