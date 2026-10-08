import React, { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ChevronDown,
  SlidersHorizontal,
  X,
  Share2,
  Copy,
  Minus,
  Plus,
  Check,
  ZoomIn,
  Eye,
  Star,
} from "lucide-react";
import { useGala, useDialog } from "./context";
import { Icons, ProductCard, Price, Rail, Stars } from "./GalaShell";
import { useSaved } from "../form/FormShell";
import { useCart } from "@/hooks/useCart";
import { api, getProduct, getProducts, jsonRequest } from "@/api/store";
import { storeKey, storeUrl } from "@/lib/store-scope";
export function FAQ({ items, title }) {
  const { pick } = useGala();
  const [opened, setOpened] = useState(-1);
  return (
    <section className="section faq-section">
      <div className="container narrow">
        <h2 className="faq-title">{title}</h2>
        {items.map((item, i) => (
          <div className={"faq-item " + (opened === i ? "open" : "")} key={i}>
            <button
              className="faq-q"
              aria-expanded={opened === i}
              onClick={() => setOpened(opened === i ? -1 : i)}
            >
              <span>{pick(item.question)}</span>
              <ChevronDown size={16} />
            </button>
            <div
              className="faq-a"
              style={{
                display: opened === i ? "block" : undefined,
                maxHeight: opened === i ? "none" : undefined,
              }}
            >
              {opened === i && <p>{pick(item.answer)}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
function SectionHeader({ title, link }) {
  const { t } = useGala();
  return (
    <div className="section-header th-sh">
      <h2>{title}</h2>
      {link && (
        <Link className="view-all" to={link}>
          {t("View all →", "عرض الكل ←")}
        </Link>
      )}
    </div>
  );
}
function selected(items, ids, limit) {
  return (
    ids.length
      ? ids.map((id) => items.find((p) => p.id === id)).filter(Boolean)
      : items
  ).slice(0, limit);
}
export function Home() {
  const {
    store,
    config,
    products,
    collections,
    pick,
    t,
    language,
    error,
    loading,
  } = useGala();
  const cols = selected(collections, config.collectionIds, 30),
    trending = selected(products, config.trendingIds, 8),
    looks = selected(products, config.lookbookIds, 5);
  const sections = {
    hero: (
      <section className="hero th-hero th-hero-collage">
        <div className="container th-hero-grid">
          <div className="th-hero-text">
            <h1>{store.hero.title}</h1>
            <p>{store.hero.text}</p>
            <div className="hero-btns">
              <Link to={config.hero.primaryLink} className="hero-btn primary">
                {pick(config.hero.primary)}
              </Link>
              <Link
                to={config.hero.secondaryLink}
                className="hero-btn secondary"
              >
                {pick(config.hero.secondary)}
              </Link>
            </div>
          </div>
          <div className="th-hero-mosaic">
            {config.hero.images.map((src, i) => (
              <div className={"th-tile th-tile-" + (i + 1)} key={i}>
                <img
                  src={src}
                  alt={i === 0 ? store.hero.alt : ""}
                  style={{ objectPosition: `50% ${config.hero.positions[i]}%` }}
                  fetchPriority={i === 0 ? "high" : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    ),
    collections: cols.length > 0 && (
      <section className="section collections-section th-collections th-collections-circles">
        <div className="container">
          <SectionHeader
            title={pick(config.headings.collections)}
            link="/collections"
          />
          <Rail className="coll-grid">
            {cols.map((c) => (
              <Link
                to={"/shop?collection=" + c.id}
                className="coll-card"
                key={c.id}
              >
                <span className="coll-card-media">
                  <img
                    className="coll-card-img"
                    src={
                      c.image ||
                      products.find((p) => p.category === c.name)?.image
                    }
                    alt={language === "ar" ? c.nameAr || c.name : c.name}
                  />
                </span>
                <h3>{language === "ar" ? c.nameAr || c.name : c.name}</h3>
              </Link>
            ))}
          </Rail>
        </div>
      </section>
    ),
    trending: (
      <section className="section products-section th-products th-products-tabs">
        <div className="container">
          <SectionHeader title={pick(config.headings.trending)} link="/shop" />
          <div className="th-tabs">
            {cols.slice(0, 5).map((c, i) => (
              <Link
                className={"th-tab " + (!i ? "active" : "")}
                to={"/shop?collection=" + c.id}
                key={c.id}
              >
                {language === "ar" ? c.nameAr || c.name : c.name}
              </Link>
            ))}
          </div>
          {error ? (
            <p role="alert">{error}</p>
          ) : loading ? (
            <p role="status">
              {t("Loading the collection…", "جارٍ تحميل المجموعة…")}
            </p>
          ) : trending.length ? (
            <div className="pgrid">
              {trending.map((p) => (
                <ProductCard product={p} key={p.id} />
              ))}
            </div>
          ) : (
            <p className="gala-empty">
              {t(
                "Our next collection is coming soon.",
                "مجموعتنا القادمة قريبًا.",
              )}
            </p>
          )}
        </div>
      </section>
    ),
    lookbook: looks.length > 0 && (
      <section className="section th-lookbook th-lookbook-mosaic">
        <div className="container">
          <SectionHeader title={pick(config.headings.lookbook)} />
          <div className="th-look-grid">
            {looks.map((p, i) => (
              <Link
                className={"th-look th-look-" + (i + 1)}
                to={"/product/" + p.id}
                key={p.id}
              >
                <img src={p.image} alt={p.title} loading="lazy" />
                <span>{p.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    ),
    story: (
      <section className="section th-story th-story-image-left th-story-own">
        <div className="container th-story-grid">
          <div className="th-story-media">
            <img src={config.storyImage} alt="" loading="lazy" />
          </div>
          <div className="th-story-text">
            <h2>{store.story.title}</h2>
            <p>{store.story.text}</p>
            <Link to="/about" className="hero-btn secondary">
              {pick(config.storyButton)}
            </Link>
          </div>
        </div>
      </section>
    ),
    testimonials: config.testimonials.length > 0 && (
      <section className="section th-reviews th-reviews-cards">
        <div className="container">
          <SectionHeader title={pick(config.headings.testimonials)} />
          <div className="th-review-grid">
            {config.testimonials.map((r, i) => (
              <blockquote className="th-review" key={i}>
                <span className="th-review-stars">
                  <Stars rating={r.rating} />
                </span>
                {pick(r.title) && <strong>{pick(r.title)}</strong>}
                <p>{pick(r.body)}</p>
                <footer>{r.name}</footer>
              </blockquote>
            ))}
          </div>
          <p className="th-review-sum">
            {(
              config.testimonials.reduce((n, r) => n + r.rating, 0) /
              config.testimonials.length
            ).toFixed(1)}{" "}
            {t("out of 5 from these", "من ٥ من خلال")}{" "}
            {config.testimonials.length} {t("reviews", "آراء")}
          </p>
        </div>
      </section>
    ),
    services: (
      <section className="features-bar">
        <div className="container features-grid">
          {config.services.map((s, i) => {
            const Icon = Icons[s.icon] || Icons.chat;
            return (
              <Link className="feat" to={s.path} key={i}>
                <span className="feat-icon">
                  <Icon strokeWidth={1.5} />
                </span>
                <strong>{pick(s.title)}</strong>
                <span>{pick(s.text)}</span>
              </Link>
            );
          })}
        </div>
      </section>
    ),
    faq: <FAQ items={config.faq} title={pick(config.headings.faq)} />,
  };
  return config.sections
    .filter((s) => s.enabled)
    .map((s) => <React.Fragment key={s.id}>{sections[s.id]}</React.Fragment>);
}
export function Collections() {
  const { collections, language, t } = useGala();
  return (
    <section className="section">
      <div className="container">
        <SectionHeader title={t("Collections", "المجموعات")} />
        <div className="gala-collections-page">
          {collections.map((c) => (
            <Link
              className="coll-card"
              to={"/shop?collection=" + c.id}
              key={c.id}
            >
              {c.image && <img src={c.image} alt="" />}
              <h2>{language === "ar" ? c.nameAr || c.name : c.name}</h2>
              <p>{language === "ar" ? c.descriptionAr : c.description}</p>
              <small>
                {c.count} {t("products", "منتجات")}
              </small>
            </Link>
          ))}
        </div>
        {!collections.length && (
          <p>
            {t(
              "Collections will appear here when published.",
              "ستظهر المجموعات هنا بعد نشرها.",
            )}
          </p>
        )}
      </div>
    </section>
  );
}
export function Catalog({ saved = false }) {
  const { collections, t, language, money } = useGala(),
    { ids } = useSaved();
  const [params, setParams] = useSearchParams(),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [filterOpen, setFilterOpen] = useState(false);
  const ref = useRef();
  useDialog(filterOpen, ref, () => setFilterOpen(false));
  const collectionId = params.get("collection") || "";
  const collection = collections.find((c) => c.id === collectionId);
  const [maximum, setMaximum] = useState(1000);
  useEffect(() => {
    let active = true;
    api("/facets?collection=" + encodeURIComponent(collectionId))
      .then((d) => {
        if (active) setMaximum(Math.max(1, Math.ceil(d.maxPriceInCents / 100)));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [collectionId]);
  const query = params.toString(),
    savedIds = ids.join("|");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setError("");
    setData(null);
    if (saved && !savedIds) {
      setData({ products: [], total: 0 });
      return;
    }
    getProducts({
      ...Object.fromEntries(new URLSearchParams(query)),
      ...(saved ? { ids: savedIds.split("|") } : {}),
      signal: controller.signal,
    })
      .then((d) => active && setData(d))
      .catch((e) => {
        if (active && e.name !== "AbortError") setError(e.message);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [query, saved, savedIds, language]);
  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "offset") next.delete("offset");
    setParams(next);
  };
  const title = saved
    ? t("Saved items", "المفضلة")
    : collection
      ? language === "ar"
        ? collection.nameAr || collection.name
        : collection.name
      : t("All products", "كل المنتجات");
  const filters = (mobile = false) => (
    <>
      <div className="gala-filter-head">
        <b>{t("Filters", "الفلاتر")}</b>
        <button
          onClick={() => setFilterOpen(false)}
          aria-label={t("Close filters", "إغلاق الفلاتر")}
        >
          <X />
        </button>
      </div>
      <div className="filter-group">
        <h4 className="filter-title">
          <SlidersHorizontal />
          {t("Price range", "نطاق السعر")}
        </h4>
        <input
          aria-label={t("Maximum price", "أعلى سعر")}
          type="range"
          min="0"
          max={maximum}
          value={params.get("max_price") ?? maximum}
          onChange={(e) => set("max_price", e.target.value)}
        />
        <div className="gala-range">
          <span>{money(0)}</span>
          <span>{money(Number(params.get("max_price") ?? maximum) * 100)}</span>
        </div>
      </div>
      <div className="filter-group">
        <h4 className="filter-title">
          <Eye />
          {t("Availability", "التوافر")}
        </h4>
        {[
          ["", t("Everything", "الكل")],
          ["1", t("In Stock", "متوفر")],
          ["0", t("Out of Stock", "غير متوفر")],
        ].map(([value, label]) => (
          <label className="filter-check" key={value}>
            <input
              type="radio"
              value={value}
              name={mobile ? "mobile-stock" : "desktop-stock"}
              checked={(params.get("in_stock") || "") === value}
              onChange={() => set("in_stock", value)}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="filter-group">
        <h4 className="filter-title">
          <Star />
          {t("Rating", "التقييم")}
        </h4>
        {["", 4, 3, 2, 1].map((value) => (
          <label className="filter-check" key={value}>
            <input
              type="radio"
              value={value}
              name={mobile ? "mobile-rating" : "desktop-rating"}
              checked={(params.get("rating") || "") === String(value)}
              onChange={() => set("rating", value)}
            />
            {value ? (
              <>
                <Stars rating={value} /> {t("& up", "فأعلى")}
              </>
            ) : (
              t("Any rating", "كل التقييمات")
            )}
          </label>
        ))}
      </div>
      {(params.has("in_stock") ||
        params.has("rating") ||
        params.has("max_price")) && (
        <button
          className="hero-btn secondary"
          onClick={() =>
            setParams(collection ? { collection: collection.id } : {})
          }
        >
          {t("Clear filters", "مسح الفلاتر")}
        </button>
      )}
      <button
        className="gala-filter-done hero-btn primary"
        onClick={() => setFilterOpen(false)}
      >
        {t("Show products", "عرض المنتجات")}
      </button>
    </>
  );
  return (
    <section className="section gala-catalog">
      <div className="container">
        <div className="th-coll-banner">
          {collection?.image && (
            <img className="th-coll-banner-img" src={collection.image} alt="" />
          )}
          <div className="container">
            <nav className="breadcrumb">
              <Link to="/">{t("Home", "الرئيسية")}</Link>
              <span>/</span>
              <span>{title}</span>
            </nav>
            <h1>
              {title} <sup>{data?.total ?? ""}</sup>
            </h1>
          </div>
        </div>
        <div className="page-title-row">
          <label className="bz-sort">
            {t("Sort", "ترتيب")}
            <select
              className="bz-sort__sel"
              value={params.get("sort") || "featured"}
              onChange={(e) => set("sort", e.target.value)}
            >
              {[
                ["featured", t("Featured", "مختارات")],
                ["newest", t("Newest first", "الأحدث")],
                ["price-asc", t("Price: low to high", "السعر: الأقل أولًا")],
                ["price-desc", t("Price: high to low", "السعر: الأعلى أولًا")],
                ["name-asc", t("Name: A to Z", "الاسم: تصاعدي")],
                ["name-desc", t("Name: Z to A", "الاسم: تنازلي")],
              ].map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="gala-filter-trigger"
            onClick={() => setFilterOpen(true)}
          >
            <SlidersHorizontal size={16} />
            {t("Filters", "الفلاتر")}
          </button>
        </div>
        <div className="shop-layout">
          <aside className="shop-sidebar gala-desktop-filters">
            {filters()}
          </aside>
          <div className="shop-main">
            {error ? (
              <p role="alert">{error}</p>
            ) : !data ? (
              <p role="status">{t("Loading…", "جارٍ التحميل…")}</p>
            ) : (
              <>
                <div className="pgrid">
                  {data.products.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
                {!data.products.length && (
                  <div className="gala-empty">
                    <h2>{t("No products found", "لا توجد منتجات")}</h2>
                    <p>
                      {t(
                        "Try another filter or browse our collection.",
                        "جرّب فلترًا آخر أو تصفح المجموعة.",
                      )}
                    </p>
                    <Link to="/shop">
                      {t("Browse products", "تصفح المنتجات")}
                    </Link>
                  </div>
                )}
                <div className="gala-pagination">
                  {Number(params.get("offset")) > 0 && (
                    <button
                      onClick={() =>
                        set(
                          "offset",
                          Math.max(0, Number(params.get("offset")) - 24),
                        )
                      }
                    >
                      {t("Previous", "السابق")}
                    </button>
                  )}
                  {data.hasMore && (
                    <button
                      onClick={() =>
                        set("offset", (Number(params.get("offset")) || 0) + 24)
                      }
                    >
                      {t("Next", "التالي")}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {filterOpen && (
        <div
          className="gala-mobile-overlay"
          onClick={() => setFilterOpen(false)}
        >
          <aside
            className="gala-filter-panel"
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={t("Filters", "الفلاتر")}
            onClick={(e) => e.stopPropagation()}
          >
            {filters(true)}
          </aside>
        </div>
      )}
    </section>
  );
}
function ProductRail({ title, items }) {
  if (!items.length) return null;
  return (
    <section className="section related-section">
      <div className="container">
        <div className="section-header">
          <h2>{title}</h2>
        </div>
        <div className="pgrid">
          {items.map((p) => (
            <ProductCard product={p} key={p.id} />
          ))}
        </div>
      </div>
    </section>
  );
}
export function Product() {
  const { id } = useParams(),
    {
      t,
      language,
      products,
      config,
      pick,
      money,
      preview,
      setCartOpen,
      includeProducts,
    } = useGala(),
    { addToCart, cartItems } = useCart(),
    navigate = useNavigate();
  const [p, setP] = useState(null),
    [error, setError] = useState(""),
    [choices, setChoices] = useState({}),
    [qty, setQty] = useState(1),
    [image, setImage] = useState(0),
    [zoom, setZoom] = useState(false),
    [reviews, setReviews] = useState([]),
    [recent, setRecent] = useState([]),
    [busy, setBusy] = useState(false),
    [share, setShare] = useState("");
  const zoomRef = useRef(),
    reviewsRef = useRef(),
    touch = useRef();
  useDialog(zoom, zoomRef, () => setZoom(false));
  useEffect(() => {
    let active = true;
    setP(null);
    setError("");
    setImage(0);
    setQty(1);
    setReviews([]);
    getProduct(id)
      .then((p) => {
        if (!active) return;
        setP(p);
        setChoices(
          Object.fromEntries(
            (p.variants[0].optionValues || []).map((o) => [o.name, o.value]),
          ),
        );
        let previous = [];
        try {
          previous = JSON.parse(
            localStorage.getItem(storeKey("gala-recent")) || "[]",
          ).filter((x) => typeof x === "string" && x !== id);
          setRecent(previous);
          localStorage.setItem(
            storeKey("gala-recent"),
            JSON.stringify([id, ...previous].slice(0, 10)),
          );
        } catch {
          setRecent([]);
        }
        const ids = [
          ...new Set([
            ...previous,
            ...Object.values(p.merchandising || {}).flat(),
          ]),
        ]
          .filter((x) => typeof x === "string")
          .slice(0, 100);
        if (ids.length)
          getProducts({ ids })
            .then((r) => {
              if (active) includeProducts(r.products);
            })
            .catch(() => {});
      })
      .catch((e) => active && setError(e.message));
    api("/retail/reviews/" + encodeURIComponent(id))
      .then((r) => active && setReviews(r.reviews))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, language, includeProducts]);
  const [sticky, setSticky] = useState(false);
  useEffect(() => {
    if (!p) return;
    const actions = document.querySelector(".gala-store .pd-actions");
    if (!actions) return;
    const observer = new IntersectionObserver(([entry]) =>
      setSticky(!entry.isIntersecting),
    );
    observer.observe(actions);
    return () => observer.disconnect();
  }, [p]);
  if (!p)
    return (
      <section className="section container" role={error ? "alert" : "status"}>
        {error || t("Loading…", "جارٍ التحميل…")}
      </section>
    );
  const optionNames = [
    ...new Set(
      p.variants.flatMap((v) => (v.optionValues || []).map((o) => o.name)),
    ),
  ];
  const variant = optionNames.length
    ? p.variants.find((v) =>
        optionNames.every((name) =>
          (v.optionValues || []).some(
            (o) => o.name === name && o.value === choices[name],
          ),
        ),
      )
    : p.variants.find((v) => v.id === choices.variant) || p.variants[0];
  const stock = variant
    ? variant.manage_inventory
      ? variant.inventory_quantity
      : 99
    : 0;
  const remaining =
    stock -
    (cartItems.find((i) => i.variant.id === variant?.id)?.quantity || 0);
  const shownReviews = reviews.length
    ? reviews
    : preview
      ? config.testimonials.map((r, i) => ({
          ...r,
          id: i,
          body: pick(r.body),
          title: pick(r.title),
        }))
      : [];
  const avg = shownReviews.length
    ? shownReviews.reduce((n, r) => n + r.rating, 0) / shownReviews.length
    : 0;
  const bundleItems = (p.merchandising?.bundleIds || [])
    .filter((x) => x !== p.id)
    .map((id) => products.find((x) => x.id === id))
    .filter(Boolean);
  const add = async (buy = false) => {
    setBusy(true);
    setError("");
    try {
      if (!variant)
        throw new Error(t("Choose available options.", "اختر خيارات متاحة."));
      const live = await getProduct(p.id);
      const v = live.variants.find((x) => x.id === variant.id);
      if (!v)
        throw new Error(
          t("This option is no longer available.", "هذا الخيار لم يعد متاحًا."),
        );
      await addToCart(live, v, qty, v.inventory_quantity);
      if (buy) navigate("/checkout");
      else setCartOpen(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShare(t("Link copied", "تم نسخ الرابط"));
    } catch {
      setShare(window.location.href);
    }
  };
  return (
    <>
      <section className="section pd-section">
        <div className="container">
          <nav className="breadcrumb">
            <Link to="/shop">{t("Products", "المنتجات")}</Link>
            <span>/</span>
            <span>{p.title}</span>
          </nav>
          <div className="product-detail">
            <div className="pd-images pd-sticky">
              <div
                className="pd-main-img"
                onTouchStart={(e) => {
                  touch.current = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY,
                  };
                }}
                onTouchEnd={(e) => {
                  if (!touch.current) return;
                  const dx = e.changedTouches[0].clientX - touch.current.x,
                    dy = e.changedTouches[0].clientY - touch.current.y;
                  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
                    setImage(
                      (i) =>
                        (i + (dx < 0 ? 1 : -1) + p.images.length) %
                        p.images.length,
                    );
                }}
              >
                <button
                  className="gala-image-zoom"
                  onClick={() => setZoom(true)}
                  aria-label={t("Enlarge image", "تكبير الصورة")}
                >
                  <img src={p.images[image]?.url || p.image} alt={p.title} />
                  <ZoomIn size={19} />
                </button>
              </div>
              {p.images.length > 1 && (
                <div className="pd-thumbs">
                  {p.images.map((im, i) => (
                    <button
                      key={i}
                      onClick={() => setImage(i)}
                      aria-label={t("Image ", "الصورة ") + (i + 1)}
                      aria-pressed={image === i}
                    >
                      <img
                        className={"thumb " + (image === i ? "active" : "")}
                        src={im.url}
                        alt=""
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="pd-info">
              <span className="pd-category">{p.category}</span>
              <h1>{p.title}</h1>
              {config.product.reviews && shownReviews.length > 0 && (
                <button
                  className="pd-rating"
                  onClick={() => {
                    reviewsRef.current.open = true;
                    reviewsRef.current.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Stars rating={avg} />
                  <span className="rating-count">
                    {avg.toFixed(1)} ({shownReviews.length}{" "}
                    {t("reviews", "تقييمات")})
                  </span>
                </button>
              )}
              <div className="pd-price">
                <Price product={p} variant={variant} />
              </div>
              <div
                className="pd-desc"
                dangerouslySetInnerHTML={{ __html: p.description }}
              />
              {optionNames.map((name) => (
                <div className="variant-option-group" key={name}>
                  <label>
                    {language === "ar"
                      ? {
                          Size: "المقاس",
                          Colour: "اللون",
                          Color: "اللون",
                          Waist: "الخصر",
                        }[name] || name
                      : name}
                    <select
                      value={choices[name] || ""}
                      onChange={(e) =>
                        setChoices({ ...choices, [name]: e.target.value })
                      }
                    >
                      {[
                        ...new Set(
                          p.variants.flatMap((v) =>
                            v.optionValues
                              .filter((o) => o.name === name)
                              .map((o) => o.value),
                          ),
                        ),
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
              {!optionNames.length && p.variants.length > 1 && (
                <label>
                  {t("Style", "الخيار")}
                  <select
                    value={variant?.id || ""}
                    onChange={(e) => setChoices({ variant: e.target.value })}
                  >
                    {p.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="pd-variant-meta">
                {config.product.showSku && variant?.sku}{" "}
                {config.product.showStock &&
                  (stock > 0
                    ? t("In stock", "متوفر") +
                      (variant?.manage_inventory ? ` (${stock})` : "")
                    : t("Out of stock", "غير متوفر"))}
              </p>
              <div className="pd-actions">
                <div className="qty-wrap">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    aria-label={t("Reduce quantity", "تقليل الكمية")}
                  >
                    <Minus size={12} />
                  </button>
                  <input
                    aria-label={t("Quantity", "الكمية")}
                    type="number"
                    min="1"
                    max={Math.max(1, remaining)}
                    value={qty}
                    onChange={(e) =>
                      setQty(
                        Math.max(1, Math.min(99, Number(e.target.value) || 1)),
                      )
                    }
                  />
                  <button
                    onClick={() =>
                      setQty(Math.min(Math.max(1, remaining), qty + 1))
                    }
                    aria-label={t("Increase quantity", "زيادة الكمية")}
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <button
                  className="btn-atc"
                  disabled={busy || remaining < qty || !p.purchasable}
                  onClick={() => add()}
                >
                  {t("Add to cart", "أضف للسلة")}
                </button>
                <button
                  className="btn-buynow"
                  disabled={busy || remaining < qty || !p.purchasable}
                  onClick={() => add(true)}
                >
                  {t("Buy it now", "اشترِ الآن")}
                </button>
              </div>
              {error && (
                <p className="gala-alert" role="alert">
                  {error}
                </p>
              )}
              <table className="pd-specs">
                <tbody>
                  {p.additional_info.map((i, j) => (
                    <tr key={j}>
                      <th>{i.title}</th>
                      <td dangerouslySetInnerHTML={{ __html: i.description }} />
                    </tr>
                  ))}
                </tbody>
              </table>
              {config.product.sharing && (
                <div className="pd-share">
                  <span>{t("Share", "مشاركة")}</span>
                  <button
                    onClick={async () => {
                      if (navigator.share)
                        try {
                          await navigator.share({
                            title: p.title,
                            url: location.href,
                          });
                        } catch {}
                      else copyLink();
                    }}
                  >
                    <Share2 size={13} />
                    {t("Share", "مشاركة")}
                  </button>
                  {[
                    ["WhatsApp", "https://wa.me/?text="],
                    [
                      "Facebook",
                      "https://www.facebook.com/sharer/sharer.php?u=",
                    ],
                    ["X", "https://twitter.com/intent/tweet?url="],
                    ["Telegram", "https://t.me/share/url?url="],
                    [
                      "Pinterest",
                      "https://pinterest.com/pin/create/button/?url=",
                    ],
                  ].map(([label, url]) => (
                    <a
                      key={label}
                      target="_blank"
                      rel="noreferrer"
                      href={url + encodeURIComponent(window.location.href)}
                    >
                      {label}
                    </a>
                  ))}
                  <a
                    href={
                      "mailto:?body=" + encodeURIComponent(window.location.href)
                    }
                  >
                    {t("Email", "البريد")}
                  </a>
                  <button onClick={copyLink}>
                    <Copy size={12} />
                    {t("Copy link", "نسخ الرابط")}
                  </button>
                  <span role="status">{share}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      {config.product.stickyBuy && sticky && (
        <div className="gala-sticky-buy">
          <div>
            {p.title}
            <br />
            <b>
              <Price product={p} variant={variant} />
            </b>
          </div>
          <button
            className="hero-btn primary"
            disabled={busy || remaining < qty}
            onClick={() => add()}
          >
            {t("Add to cart", "أضف للسلة")}
          </button>
        </div>
      )}
      {config.product.reviews && (
        <section className="section reviews-section" id="reviews">
          <div className="container">
            <details className="reviews-acc" ref={reviewsRef}>
              <summary className="section-header reviews-summary">
                <h2>{t("Customer Reviews", "تقييمات العملاء")}</h2>
                <Stars rating={avg} />
                <span>
                  {avg.toFixed(1)} {t("out of 5", "من ٥")} (
                  {shownReviews.length})
                </span>
                <ChevronDown size={18} />
              </summary>
              <div className="reviews-body">
                <div className="reviews-grid">
                  {shownReviews.map((r) => (
                    <article className="review-card" key={r.id}>
                      <b>{r.name}</b>
                      <Stars rating={r.rating} />
                      {r.title && <h3>{r.title}</h3>}
                      <p>{r.body}</p>
                      {r.images?.map((id) => (
                        <img
                          className="gala-review-photo"
                          key={id}
                          src={storeUrl("/api/retail/review-image/" + id)}
                          alt={t("Customer photo", "صورة العميل")}
                        />
                      ))}
                    </article>
                  ))}
                </div>
                <p>
                  {t(
                    "Reviews from delivered purchases can be submitted in your account.",
                    "يمكنك تقييم مشترياتك بعد التسليم من حسابك.",
                  )}
                </p>
                <Link className="hero-btn secondary" to="/account">
                  {t("Write a review", "اكتب تقييمًا")}
                </Link>
              </div>
            </details>
          </div>
        </section>
      )}
      {config.product.bundles && bundleItems.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="gala-bundle">
              <b>{t("Frequently bought together", "يُشترى معًا كثيرًا")}</b>
              <div>
                {[p, ...bundleItems].map((x, i) => (
                  <React.Fragment key={x.id}>
                    {i > 0 && <span>+</span>}
                    <Link to={"/product/" + x.id}>
                      <img src={x.image} alt="" />
                      <small>{x.title}</small>
                    </Link>
                  </React.Fragment>
                ))}
              </div>
              <p>
                {t("Total price: ", "الإجمالي: ")}
                <b>
                  {money(
                    [variant, ...bundleItems.map((x) => x.variants[0])]
                      .filter(Boolean)
                      .reduce(
                        (n, v) =>
                          n + (v.sale_price_in_cents ?? v.price_in_cents),
                        0,
                      ),
                  )}
                </b>
              </p>
              <button
                className="hero-btn primary"
                disabled={busy || !variant}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const fetched = await Promise.all(
                      [p, ...bundleItems].map((x) => getProduct(x.id)),
                    );
                    const lines = fetched.map((x, i) => ({
                      p: x,
                      v: i
                        ? x.variants[0]
                        : x.variants.find((v) => v.id === variant.id),
                    }));
                    for (const x of lines) {
                      if (
                        !x.v ||
                        !x.p.purchasable ||
                        (x.v.manage_inventory &&
                          x.v.inventory_quantity <
                            1 +
                              (cartItems.find((i) => i.variant.id === x.v.id)
                                ?.quantity || 0))
                      )
                        throw new Error(
                          t(
                            "A bundle item is unavailable.",
                            "أحد منتجات المجموعة غير متوفر.",
                          ),
                        );
                    }
                    for (const x of lines)
                      await addToCart(x.p, x.v, 1, x.v.inventory_quantity);
                    setCartOpen(true);
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("Add all to cart", "إضافة الكل للسلة")}
              </button>
            </div>
          </div>
        </section>
      )}
      {config.product.related && (
        <ProductRail
          title={t("Related Products", "منتجات ذات صلة")}
          items={selected(
            products.filter((x) => x.id !== p.id),
            p.merchandising?.relatedIds || [],
            4,
          )}
        />
      )}
      {config.product.recent && (
        <ProductRail
          title={t("Recently Viewed", "شاهدت مؤخرًا")}
          items={recent
            .map((id) => products.find((x) => x.id === id))
            .filter(Boolean)
            .slice(0, 4)}
        />
      )}
      {config.product.recommendations && (
        <ProductRail
          title={t("You may also like", "قد يعجبك أيضًا")}
          items={(p.merchandising?.recommendedIds || [])
            .map((id) => products.find((x) => x.id === id))
            .filter(Boolean)}
        />
      )}
      <FAQ
        title={t("Product FAQ", "أسئلة عن المنتج")}
        items={config.productFaq}
      />
      {zoom && (
        <div
          className="gala-zoom"
          role="dialog"
          aria-modal="true"
          aria-label={t("Product image", "صورة المنتج")}
          ref={zoomRef}
          onClick={() => setZoom(false)}
        >
          <button
            aria-label={t("Close", "إغلاق")}
            onClick={() => setZoom(false)}
          >
            <X />
          </button>
          <img src={p.images[image]?.url || p.image} alt={p.title} />
        </div>
      )}
    </>
  );
}
export function Information({ type }) {
  const { store, t, config } = useGala();
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const titles = {
    about: store.story.title,
    contact: t("Contact us", "تواصل معنا"),
    shipping: t("Shipping", "الشحن"),
    returns: t("Returns & exchanges", "الاسترجاع والاستبدال"),
    privacy: t("Privacy policy", "سياسة الخصوصية"),
    terms: t("Terms & conditions", "الشروط والأحكام"),
  };
  return (
    <section className="section">
      <div className="container gala-information">
        <h1>{titles[type] || t("Page not found", "الصفحة غير موجودة")}</h1>
        {type === "about" ? (
          <>
            <img src={config.storyImage} alt="" />
            <p>{store.story.text}</p>
          </>
        ) : type === "contact" ? (
          <>
            <p>
              {store.footer.email && (
                <a href={"mailto:" + store.footer.email}>
                  {store.footer.email}
                </a>
              )}{" "}
              {store.footer.phone && (
                <a href={"tel:" + store.footer.phone}>{store.footer.phone}</a>
              )}
            </p>
            <p>{store.footer.location}</p>
            <form
              className="gala-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await api(
                    "/contact",
                    jsonRequest(
                      "POST",
                      Object.fromEntries(new FormData(e.currentTarget)),
                    ),
                  );
                  setStatus(
                    t(
                      "Message received. The store will reply using your email.",
                      "تم استلام رسالتك. سيرد المتجر عبر بريدك.",
                    ),
                  );
                  e.target.reset();
                } catch (e) {
                  setStatus(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                {t("Name", "الاسم")}
                <input name="name" maxLength={120} required />
              </label>
              <label>
                {t("Email", "البريد")}
                <input name="email" type="email" maxLength={200} required />
              </label>
              <label>
                {t("Message", "الرسالة")}
                <textarea name="body" maxLength={4000} required />
              </label>
              <button className="hero-btn primary" disabled={busy}>
                {t("Send message", "إرسال الرسالة")}
              </button>
              <p role="status">{status}</p>
            </form>
          </>
        ) : (
          <p style={{ whiteSpace: "pre-line" }}>{store.pages[type]}</p>
        )}
        {type === "returns" && (
          <Link className="hero-btn secondary" to="/account">
            {t("Manage a return", "إدارة طلب استرجاع")}
          </Link>
        )}
      </div>
    </section>
  );
}
