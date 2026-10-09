import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProducts } from "@/api/store";
import { storeKey } from "@/lib/store-scope";
import { useLanguage } from "@/i18n/LanguageContext";
export default function Recommendations({ product }) {
  const { language } = useLanguage(),
    [items, setItems] = useState([]);
  useEffect(() => {
    setItems([]);
    const controller = new AbortController();
    let recent = [];
    try {
      recent = JSON.parse(localStorage.getItem(storeKey("recent")) || "[]");
      localStorage.setItem(
        storeKey("recent"),
        JSON.stringify(
          [product.id, ...recent.filter((i) => i !== product.id)].slice(0, 12),
        ),
      );
    } catch {}
    const ids = [
      ...new Set([
        ...(product.merchandising?.relatedIds || []),
        ...(product.merchandising?.bundleIds || []),
        ...recent,
      ]),
    ]
      .filter((i) => i !== product.id)
      .slice(0, 20);
    if (ids.length)
      getProducts({ ids, signal: controller.signal })
        .then((r) =>
          setItems(
            r.products.filter((p) =>
              p.variants.some(
                (v) => !v.manage_inventory || v.inventory_quantity > 0,
              ),
            ),
          ),
        )
        .catch(() => {});
    return () => controller.abort();
  }, [
    language,
    product.id,
    product.merchandising?.bundleIds,
    product.merchandising?.relatedIds,
  ]);
  return items.length ? (
    <section className="commerce-recommendations">
      <h2>
        {language === "ar"
          ? "قطع مختارة وما شاهدته مؤخرًا"
          : "Selected pieces & recently viewed"}
      </h2>
      <div>
        {items.map((p) => (
          <Link key={p.id} to={"/product/" + p.id}>
            <img src={p.image} alt={p.title} loading="lazy" />
            <span>{p.title}</span>
            <small>{p.price_formatted}</small>
          </Link>
        ))}
      </div>
    </section>
  ) : null;
}
