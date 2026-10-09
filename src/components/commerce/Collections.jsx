import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/store";
import { useLanguage } from "@/i18n/LanguageContext";
export default function Collections() {
  const { language } = useLanguage(),
    [items, setItems] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("/collections")
      .then((r) => setItems(r.collections))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="commerce-collections">
      <h1>{language === "ar" ? "المجموعات" : "Collections"}</h1>
      {error && <p role="alert">{error}</p>}
      {items?.length === 0 && (
        <p>
          {language === "ar"
            ? "ستظهر المجموعات المنشورة هنا."
            : "Published collections will appear here."}
        </p>
      )}
      <div className="commerce-collection-grid">
        {items?.map((c) => (
          <Link to={"/shop?collection=" + c.id} key={c.id}>
            {c.image && <img src={c.image} alt="" loading="lazy" />}
            <h2>{language === "ar" ? c.nameAr || c.name : c.name}</h2>
            <p>
              {language === "ar"
                ? c.descriptionAr || c.description
                : c.description}
            </p>
            <span>{c.count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
