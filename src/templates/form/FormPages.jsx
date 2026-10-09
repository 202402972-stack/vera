import ReactOverlay from "@/components/commerce/Overlay";
import Recommendations from "@/components/commerce/Recommendations";
import Community from "@/components/commerce/Community";
import { storeKey } from "@/lib/store-scope";
import React, { useEffect, useState } from "react";
import { Link, useSearchParams, useParams } from "react-router-dom";
import {
  Heart,
  ShoppingBag,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Minus,
  Search,
  SlidersHorizontal,
  ChevronRight,
  X,
} from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useCart } from "@/hooks/useCart";
import { useLanguage } from "@/i18n/LanguageContext";
import { api, getProducts, getProduct } from "@/api/store";
import { useCopy, useSaved } from "./FormShell";
export function ProductCard({ product }) {
  const { ids, toggle } = useSaved(),
    t = useCopy(),
    v = product.variants[0];
  return (
    <article className="form-product">
      <div className="form-product-image">
        <Link to={`/product/${product.id}`}>
          <img src={product.image} alt={product.title} loading="lazy" />
        </Link>
        <button
          className={ids.includes(product.id) ? "is-saved" : ""}
          aria-pressed={ids.includes(product.id)}
          onClick={() => toggle(product.id)}
          aria-label={t("Save ", "حفظ ") + product.title}
        >
          <Heart size={18} />
        </button>
        {product.ribbon_text && (
          <span className="form-badge">{product.ribbon_text}</span>
        )}
      </div>
      <div className="form-product-caption">
        <Link to={`/product/${product.id}`}>{product.title}</Link>
        <span>{v.sale_price_formatted || v.price_formatted}</span>
      </div>
      <p>{product.category}</p>
      <Link className="form-text-link" to={`/product/${product.id}`}>
        {t("Discover", "اكتشف")} <ArrowUpRight size={13} />
      </Link>
    </article>
  );
}
function useCatalog(query = {}) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const { language } = useLanguage();
  const key = JSON.stringify(query);
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    getProducts({ ...JSON.parse(key), signal: c.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => c.abort();
  }, [key, language]);
  return { data, error };
}
export function Status({ error, empty }) {
  const t = useCopy();
  return (
    <div className="form-empty" role={error ? "alert" : "status"}>
      <ShoppingBag size={28} />
      <h2>
        {error
          ? t("Something went wrong", "تعذّر التحميل")
          : empty
            ? t("Nothing here yet.", "لا توجد منتجات هنا بعد.")
            : t("Loading the collection…", "جارٍ تحميل المجموعة…")}
      </h2>
      <p>
        {error ||
          (empty
            ? t(
                "Explore another category or check back for new arrivals.",
                "جرّب تصنيفًا آخر أو عد قريبًا لاكتشاف الجديد.",
              )
            : "")}
      </p>
      {error && (
        <button
          className="form-button"
          onClick={() => window.location.reload()}
        >
          {t("Try again", "حاول مجددًا")}
        </button>
      )}
    </div>
  );
}
function orderSections(
  fragment,
  order = ["categories", "arrivals", "campaign"],
) {
  const nodes = React.Children.toArray(fragment.props.children).filter(Boolean);
  const keys = {
    "form-categories": "categories",
    "form-section": "arrivals",
    "form-campaign": "campaign",
  };
  const movable = nodes.filter((n) => keys[n.props?.className]);
  const sorted = [...movable].sort(
    (a, b) =>
      order.indexOf(keys[a.props.className]) -
      order.indexOf(keys[b.props.className]),
  );
  let index = 0;
  return (
    <>{nodes.map((n) => (keys[n.props?.className] ? sorted[index++] : n))}</>
  );
}
export function Home() {
  const { store } = useStore(),
    t = useCopy(),
    { data, error } = useCatalog(
      store.form?.featuredIds?.length ? { ids: store.form.featuredIds } : {},
    ),
    [collections, setCollections] = useState([]);
  useEffect(() => {
    api("/collections")
      .then((d) => setCollections(d.collections))
      .catch(() => {});
  }, []);
  const categories = collections.length
    ? collections
        .filter((c) => c.count > 0)
        .map((c) => ({
          name: t(c.name, c.nameAr || c.name),
          image: c.image || data?.products[0]?.image,
          href: `/shop?collection=${c.id}`,
        }))
    : [
        ...new Set(
          data?.products
            .map((p) => p._base?.category || p.category)
            .filter(Boolean),
        ),
      ].map((name) => ({
        name: data.products.find(
          (p) => (p._base?.category || p.category) === name,
        ).category,
        image: data.products.find(
          (p) => (p._base?.category || p.category) === name,
        ).image,
        href: `/shop?category=${encodeURIComponent(name)}`,
      }));
  return orderSections(
    <>
      <section
        className="form-hero"
        style={{
          "--hero-position": `${store.form?.heroPosition ?? 15}%`,
          "--mobile-position": `${store.form?.mobilePosition ?? 65}%`,
        }}
      >
        <img src={store.hero.image} alt={store.hero.alt} fetchPriority="high" />
        <div className="form-hero-copy">
          <span className="form-eyebrow">
            {t("A fresh perspective", "نظرة جديدة")}
          </span>
          <h1>{store.hero.title}</h1>
          <p>{store.hero.text}</p>
          <Link to="/shop" className="form-button">
            {store.hero.button}
            <ArrowUpRight size={19} />
          </Link>
        </div>
        <span className="form-hero-index">
          01 — {t("THE EVERYDAY EDIT", "اختيارات يومك")}
        </span>
      </section>
      {store.form?.categoriesEnabled !== false && categories.length > 0 && (
        <section className="form-categories">
          {categories.slice(0, 4).map((c) => (
            <Link key={c.name} to={c.href}>
              <img src={c.image} alt="" />
              <span>
                {c.name}
                <ArrowUpRight size={23} />
              </span>
            </Link>
          ))}
        </section>
      )}
      {store.form?.arrivalsEnabled !== false && (
        <section className="form-section">
          <div className="form-section-heading">
            <div>
              <span className="form-eyebrow">
                {t("The collection", "المجموعة")}
              </span>
              <h2>{store.collection.title}</h2>
            </div>
            <Link to="/shop">
              {t("View all", "عرض الكل")}
              <ArrowRight size={17} />
            </Link>
          </div>
          {error || !data || !data.products.length ? (
            <Status error={error} empty={data?.products.length === 0} />
          ) : (
            <div className="form-grid">
              {data.products.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      )}
      {store.form?.campaignEnabled !== false && (
        <section className="form-campaign">
          <div>
            <span className="form-eyebrow">
              {t("Objects. People. Possibilities.", "تفاصيل. أشخاص. احتمالات.")}
            </span>
            <h2>{store.story.title}</h2>
            <p>{store.story.text}</p>
            <Link className="form-button light" to="/shop">
              {t("Find your everyday", "اكتشف ما يشبهك")}
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <img
            src={store.form?.campaignImage || store.hero.image}
            alt=""
            loading="lazy"
          />
        </section>
      )}
      {store.form?.newsletterEnabled && <Community newsletter />}
      <section className="form-service">
        <span>{t("Make it your own", "اختيارات تشبهك")}</span>
        <Link to="/shipping">
          {t("Delivery information", "معلومات التوصيل")}
          <ArrowUpRight size={17} />
        </Link>
        <Link to="/returns">
          {t("Returns & exchanges", "الاسترجاع والاستبدال")}
          <ArrowUpRight size={17} />
        </Link>
        <Link to="/contact">
          {t("Here to help", "نحن هنا لمساعدتك")}
          <ArrowUpRight size={17} />
        </Link>
      </section>
    </>,
    store.form?.sectionOrder,
  );
}
export function Catalog({ saved = false }) {
  const [filtersOpen, setFiltersOpen] = useState(false),
    [draftFilters, setDraftFilters] = useState(new URLSearchParams());
  const [params, setParams] = useSearchParams(),
    { ids } = useSaved(),
    t = useCopy();
  const filterParams = filtersOpen ? draftFilters : params;
  const [categories, setCategories] = useState([]),
    [facets, setFacets] = useState({
      colors: [],
      sizes: [],
      materials: [],
      categoryLabels: {},
    }),
    [collections, setCollections] = useState([]),
    [more, setMore] = useState([]),
    [busy, setBusy] = useState(false),
    [loadError, setLoadError] = useState("");
  const query = Object.fromEntries(params),
    { data, error } = useCatalog(
      saved ? { ids: ids.length ? ids : ["__none__"] } : query,
    );
  useEffect(() => {
    api("/facets")
      .then(setFacets)
      .catch(() => {});
    api("/categories")
      .then((d) => setCategories(d.categories))
      .catch(() => {});
    api("/collections")
      .then((d) => setCollections(d.collections))
      .catch(() => {});
  }, []);
  const change = (key, value) => {
    const n = new URLSearchParams(filtersOpen ? draftFilters : params);
    value ? n.set(key, value) : n.delete(key);
    if (filtersOpen) setDraftFilters(n);
    else setParams(n);
  };
  const signature = params.toString();
  useEffect(() => {
    if (!saved)
      sessionStorage.setItem(
        storeKey("catalog-return"),
        "/shop" + (signature ? "?" + signature : ""),
      );
  }, [signature, saved]);
  useEffect(() => {
    setMore([]);
    setLoadError("");
  }, [signature]);
  const facetControls = (
    <div className="form-facet-row">
      {[
        ["colors", t("Color", "اللون")],
        ["sizes", t("Size", "المقاس")],
        ["materials", t("Material", "الخامة")],
      ]
        .filter(([key]) => facets[key].length > 0)
        .map(([key, label]) => (
          <details key={key}>
            <summary>
              {label}
              {filterParams.get(key)
                ? ` (${filterParams.get(key).split("|").length})`
                : ""}
            </summary>
            <div>
              {facets[key].map((value) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={(filterParams.get(key) || "")
                      .split("|")
                      .includes(value)}
                    onChange={(e) => {
                      const current = (filterParams.get(key) || "")
                        .split("|")
                        .filter(Boolean);
                      change(
                        key,
                        (e.target.checked
                          ? [...current, value]
                          : current.filter((x) => x !== value)
                        ).join("|"),
                      );
                    }}
                  />
                  {value}
                </label>
              ))}
            </div>
          </details>
        ))}
      <label>
        {t("Min price", "أقل سعر")}
        <input
          type="number"
          min="0"
          step="0.01"
          value={filterParams.get("min_price") || ""}
          onChange={(e) => change("min_price", e.target.value)}
        />
      </label>
      <label>
        {t("Max price", "أعلى سعر")}
        <input
          type="number"
          min="0"
          step="0.01"
          value={filterParams.get("max_price") || ""}
          onChange={(e) => change("max_price", e.target.value)}
        />
      </label>
      <label className="form-stock-filter">
        <input
          type="checkbox"
          checked={filterParams.get("in_stock") === "1"}
          onChange={(e) => change("in_stock", e.target.checked ? "1" : "")}
        />
        {t("In stock", "المتوفر فقط")}
      </label>
    </div>
  );
  return (
    <section className="form-section form-catalog">
      <span className="form-eyebrow">
        {t("Find your everyday", "اختيارات تشبهك")}
      </span>
      <h1>
        {saved
          ? t("Your saved pieces", "اختياراتك المحفوظة")
          : t("The collection", "المجموعة")}
      </h1>
      {!saved && collections.length > 0 && (
        <div className="form-collection-links">
          {collections.map((c) => (
            <button
              key={c.id}
              aria-pressed={params.get("collection") === c.id}
              onClick={() =>
                change(
                  "collection",
                  params.get("collection") === c.id ? "" : c.id,
                )
              }
            >
              {t(c.name, c.nameAr || c.name)}
            </button>
          ))}
        </div>
      )}
      {!saved && (
        <div className="form-filters">
          <label>
            <Search size={17} />
            <input
              aria-label={t("Search", "بحث")}
              value={params.get("search") || ""}
              placeholder={t("Search the collection", "ابحث في المجموعة")}
              onChange={(e) => change("search", e.target.value)}
            />
          </label>
          <label>
            <SlidersHorizontal size={16} />
            <select
              aria-label={t("Category", "التصنيف")}
              value={params.get("category") || ""}
              onChange={(e) => change("category", e.target.value)}
            >
              <option value="">{t("All categories", "كل التصنيفات")}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {t(c, facets.categoryLabels[c] || c)}
                </option>
              ))}
            </select>
          </label>
          <select
            aria-label={t("Sort", "ترتيب")}
            value={params.get("sort") || "featured"}
            onChange={(e) => change("sort", e.target.value)}
          >
            <option value="featured">{t("Featured", "المميزة")}</option>
            <option value="newest">{t("Newest", "الأحدث")}</option>
            <option value="price-asc">
              {t("Price: low to high", "السعر: من الأقل")}
            </option>
            <option value="price-desc">
              {t("Price: high to low", "السعر: من الأعلى")}
            </option>
          </select>
          <span>
            {data?.total ?? "—"} {t("products", "منتج")}
          </span>
        </div>
      )}
      {!saved && (
        <>
          <button
            className="form-mobile-filters"
            onClick={() => {
              setDraftFilters(new URLSearchParams(params));
              setFiltersOpen(true);
            }}
          >
            {t("Filters", "الفلاتر")} · {data?.total ?? "…"}
          </button>
          <div className="form-desktop-filters">{facetControls}</div>
          <ReactOverlay
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            title={t("Refine your collection", "حدد اختياراتك")}
          >
            {facetControls}
            <button
              className="form-button"
              onClick={() => {
                setParams(draftFilters);
                setFiltersOpen(false);
              }}
            >
              {t("Apply filters", "تطبيق الفلاتر")}
            </button>
            <button onClick={() => setDraftFilters(new URLSearchParams())}>
              {t("Clear", "مسح")}
            </button>
          </ReactOverlay>
          <div className="form-filter-chips">
            {[...params]
              .filter(([k]) => !["sort", "offset"].includes(k))
              .map(([k, v]) => (
                <button key={k} onClick={() => change(k, "")}>
                  {v} ×
                </button>
              ))}
          </div>
        </>
      )}
      {!saved && params.size > 0 && (
        <button className="form-text-link" onClick={() => setParams({})}>
          {t("Clear filters", "مسح الفلاتر")} <X size={14} />
        </button>
      )}
      {error || !data || !data.products.length ? (
        <Status error={error} empty={data?.products.length === 0} />
      ) : (
        <>
          <div className="form-grid">
            {[...data.products, ...more].map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {loadError && <p role="alert">{loadError}</p>}
          {data.total > data.products.length + more.length && (
            <button
              className="form-button form-load"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const n = await getProducts({
                    ...query,
                    offset: data.products.length + more.length,
                  });
                  setMore((x) => [...x, ...n.products]);
                } catch (e) {
                  setLoadError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("Load more", "عرض المزيد")}
            </button>
          )}
        </>
      )}
    </section>
  );
}
export function Product() {
  const [zoom, setZoom] = useState(false),
    [bag, setBag] = useState(false);
  const { id } = useParams(),
    t = useCopy(),
    { addToCart } = useCart(),
    { ids, toggle } = useSaved(),
    { language } = useLanguage();
  const [p, setP] = useState(null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(0),
    [image, setImage] = useState(0),
    [quantity, setQuantity] = useState(1),
    [message, setMessage] = useState("");
  useEffect(() => {
    let current = true;
    setP(null);
    setError("");
    setSelected(0);
    setImage(0);
    getProduct(id)
      .then((p) => {
        if (current) setP(p);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [id, language]);
  if (!p) return <Status error={error} />;
  const v = p.variants[selected],
    available =
      p.purchasable && (!v.manage_inventory || v.inventory_quantity > 0);
  return (
    <section className="form-section">
      <Link
        className="form-text-link"
        to={sessionStorage.getItem(storeKey("catalog-return")) || "/shop"}
      >
        {t("Collection", "المجموعة")}
        <ChevronRight size={14} />
        {p.title}
      </Link>
      <div className="form-detail">
        <div>
          <div
            className="form-detail-image"
            role="button"
            tabIndex={0}
            aria-label={t("Zoom image", "تكبير الصورة")}
            onClick={() => setZoom(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setZoom(true);
            }}
          >
            <img src={p.images[image]?.url || p.image} alt={p.title} />
          </div>
          <div className="form-thumbnails">
            {p.images.map((im, i) => (
              <button
                key={im.url}
                aria-label={t("Image ", "صورة ") + (i + 1)}
                aria-pressed={i === image}
                onClick={() => setImage(i)}
              >
                <img src={im.url} alt="" />
              </button>
            ))}
          </div>
        </div>
        <div className="form-detail-copy">
          <span className="form-eyebrow">{p.category}</span>
          <h1>{p.title}</h1>
          <p>{p.subtitle}</p>
          <div className="form-price">
            {v.sale_price_formatted || v.price_formatted}
            {v.sale_price_formatted && <del>{v.price_formatted}</del>}
          </div>
          <fieldset>
            <legend>{t("Choose an option", "اختر المواصفات")}</legend>
            <div className="form-variants">
              {p.variants.map((item, i) => (
                <button
                  key={item.id}
                  aria-pressed={i === selected}
                  onClick={() => {
                    setSelected(i);
                    setQuantity(1);
                    const im = p.images.findIndex(
                      (x) => x.url === item.image_url,
                    );
                    if (im >= 0) setImage(im);
                  }}
                >
                  {item.title}
                  {item.manage_inventory && item.inventory_quantity === 0
                    ? ` · ${t("Sold out", "نفد")}`
                    : ""}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="form-option-spec">
            {Object.entries(v.attributes || {})
              .filter(([, value]) => value)
              .map(
                ([key, value]) =>
                  `${{ color: t("Color", "اللون"), size: t("Size", "المقاس"), material: t("Material", "الخامة") }[key] || key}: ${value}`,
              )
              .join(" · ")}
          </p>
          <div className="form-buy">
            <div className="form-quantity">
              <button
                aria-label={t("Decrease", "تقليل")}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus size={14} />
              </button>
              <span>{quantity}</span>
              <button
                aria-label={t("Increase", "زيادة")}
                disabled={!available}
                onClick={() =>
                  setQuantity(
                    Math.min(
                      v.manage_inventory ? v.inventory_quantity : 99,
                      quantity + 1,
                      99,
                    ),
                  )
                }
              >
                <Plus size={14} />
              </button>
            </div>
            <button
              className="form-button"
              disabled={!available}
              onClick={async () => {
                try {
                  await addToCart(p, v, quantity, v.inventory_quantity);
                  setMessage(t("Added to your bag", "أضيف إلى حقيبتك"));
                  setBag(true);
                } catch (e) {
                  setMessage(e.message);
                }
              }}
            >
              {available
                ? t("Add to bag", "أضف للحقيبة")
                : t("Unavailable", "غير متاح")}
              <ShoppingBag size={18} />
            </button>
            <button
              className="form-save"
              aria-pressed={ids.includes(id)}
              aria-label={t("Save item", "حفظ المنتج")}
              onClick={() => toggle(id)}
            >
              <Heart fill={ids.includes(id) ? "currentColor" : "none"} />
            </button>
          </div>
          <p role="status">{message}</p>
          <Link className="form-text-link" to="/cart">
            {t("View your bag", "عرض الحقيبة")} <ArrowUpRight size={14} />
          </Link>
          <details open>
            <summary>{t("Details", "التفاصيل")}</summary>
            <div
              className="form-richtext"
              dangerouslySetInnerHTML={{ __html: p.description }}
            />
          </details>
          {p.additional_info.map((i) => (
            <details key={i.id}>
              <summary>{i.title}</summary>
              <div
                className="form-richtext"
                dangerouslySetInnerHTML={{ __html: i.description }}
              />
            </details>
          ))}
          <details>
            <summary>{t("Delivery & returns", "التوصيل والاسترجاع")}</summary>
            <Link to="/shipping">
              {t("Delivery information", "معلومات التوصيل")}
            </Link>{" "}
            ·{" "}
            <Link to="/returns">{t("Returns policy", "سياسة الاسترجاع")}</Link>
          </details>
        </div>
      </div>
      <ReactOverlay open={zoom} onClose={() => setZoom(false)} title={p.title}>
        <img src={p.images[image]?.url || p.image} alt={p.title} />
      </ReactOverlay>
      <ReactOverlay
        open={bag}
        onClose={() => setBag(false)}
        title={t("Your bag", "حقيبتك")}
      >
        <Cart />
      </ReactOverlay>
      <Recommendations product={p} />
      <Reviews productId={id} />
    </section>
  );
}
function Reviews({ productId }) {
  const [reviews, setReviews] = useState([]),
    [error, setError] = useState(""),
    t = useCopy();
  useEffect(() => {
    api(`/retail/reviews/${productId}`)
      .then((d) => setReviews(d.reviews))
      .catch((e) => setError(e.message));
  }, [productId]);
  return (
    <section className="form-reviews">
      <h2>{t("Customer reviews", "آراء العملاء")}</h2>
      {error ? (
        <p role="alert">{error}</p>
      ) : reviews.length ? (
        reviews.map((r) => (
          <article key={r.id}>
            <strong>
              {r.rating}/5 · {r.name}
            </strong>
            <p>{r.body}</p>
            <small>{t("Verified purchase", "عملية شراء مؤكدة")}</small>
          </article>
        ))
      ) : (
        <p>
          {t(
            "No reviews yet. Purchased this item? Leave a review from your account after delivery.",
            "لا توجد آراء بعد. يمكنك تقييم مشترياتك من حسابك بعد الاستلام.",
          )}
        </p>
      )}
    </section>
  );
}
export function Cart() {
  const t = useCopy(),
    { cartItems, updateQuantity, removeFromCart, getCartTotal } = useCart();
  return (
    <section className="form-section form-cart">
      <span className="form-eyebrow">{t("Almost yours", "باقي خطوة")}</span>
      <h1>{t("Your shopping bag", "حقيبة التسوق")}</h1>
      {!cartItems.length ? (
        <>
          <Status empty />
          <Link to="/shop" className="form-button">
            {t("Explore collection", "اكتشف المجموعة")}
          </Link>
        </>
      ) : (
        <div className="form-cart-layout">
          <div>
            {cartItems.map((i) => (
              <article className="form-cart-line" key={i.variant.id}>
                <Link to={`/product/${i.product.id}`}>
                  <img
                    src={i.variant.image_url || i.product.image}
                    alt={i.product.title}
                  />
                </Link>
                <div>
                  <Link to={`/product/${i.product.id}`}>
                    <h3>{i.product.title}</h3>
                  </Link>
                  <p>{i.variant.title}</p>
                  <label>
                    {t("Quantity", "الكمية")}
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={i.quantity}
                      onChange={(e) =>
                        updateQuantity(
                          i.variant.id,
                          Number(e.target.value) || 1,
                        )
                      }
                    />
                  </label>
                  <button
                    className="form-text-link"
                    onClick={() => removeFromCart(i.variant.id)}
                  >
                    {t("Remove", "إزالة")}
                  </button>
                </div>
                <strong>
                  {i.variant.sale_price_formatted || i.variant.price_formatted}
                </strong>
              </article>
            ))}
          </div>
          <aside className="form-summary">
            <h2>{t("Order summary", "ملخص الطلب")}</h2>
            <p>
              {t("Subtotal", "المجموع الفرعي")}
              <strong>{getCartTotal()}</strong>
            </p>
            <small>
              {t(
                "Delivery, discounts and taxes are calculated at checkout.",
                "تُحسب رسوم التوصيل والخصومات والضرائب عند إتمام الطلب.",
              )}
            </small>
            <Link to="/checkout" className="form-button">
              {t("Continue to checkout", "إتمام الطلب")}
              <ArrowRight size={18} />
            </Link>
            <Link to="/shop">{t("Continue shopping", "متابعة التسوق")}</Link>
          </aside>
        </div>
      )}
    </section>
  );
}
export function Information({ type }) {
  const { store } = useStore(),
    t = useCopy();
  const titles = {
    about: t("Our story", "حكايتنا"),
    contact: t("Let’s talk", "تواصل معنا"),
    shipping: t("Delivery", "التوصيل"),
    returns: t("Returns & exchanges", "الاسترجاع والاستبدال"),
    privacy: t("Privacy", "الخصوصية"),
    terms: t("Terms", "الشروط"),
    missing: t("Page not found", "الصفحة غير موجودة"),
  };
  return (
    <section className="form-section form-information">
      <span className="form-eyebrow">{store.name}</span>
      <h1>{titles[type]}</h1>
      <p>{type === "about" ? store.story.text : store.pages[type]}</p>
      {type === "missing" && (
        <Link to="/shop">{t("Explore the collection", "اكتشف المجموعة")}</Link>
      )}
      {type === "contact" && <Community />}
      {type === "contact" && (
        <>
          {store.footer.email && (
            <a href={`mailto:${store.footer.email}`}>{store.footer.email}</a>
          )}
          {store.footer.phone && (
            <p>
              <a href={`tel:${store.footer.phone}`}>{store.footer.phone}</a>
            </p>
          )}
          {!store.footer.email && !store.footer.phone && (
            <p>
              {t(
                "Contact information has not been published yet.",
                "لم تُنشر معلومات التواصل بعد.",
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}
