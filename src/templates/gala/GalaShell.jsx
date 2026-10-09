import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Search,
  Heart,
  UserRound,
  ShoppingCart,
  Menu,
  X,
  ChevronDown,
  Grid2X2,
  Home,
  Plus,
  Minus,
  Truck,
  LockKeyhole,
  RotateCcw,
  MessageSquare,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSaved } from "../form/FormShell";
import { api, jsonRequest, getProducts } from "@/api/store";
import { useGala, useDialog } from "./context";
import { storeKey } from "@/lib/store-scope";
export const Icons = {
  truck: Truck,
  lock: LockKeyhole,
  return: RotateCcw,
  chat: MessageSquare,
};
export function Stars({ rating = 5 }) {
  return (
    <span className="stars-wrap" aria-label={`${rating} / 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={i < Math.round(rating) ? "currentColor" : "none"}
          stroke="currentColor"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}
export function Price({ product, variant }) {
  const { money } = useGala();
  const v = variant || product.variants[0];
  return (
    <>
      {v.sale_price_in_cents != null && (
        <span className="compare">{money(v.price_in_cents)}</span>
      )}
      <span className="price">
        {money(v.sale_price_in_cents ?? v.price_in_cents)}
      </span>
    </>
  );
}
export function ProductCard({ product: p }) {
  const { ids, toggle } = useSaved();
  const { t } = useGala();
  return (
    <Link to={"/product/" + p.id} className="pcard prod-card">
      <div className="gala-card-image">
        <img src={p.image} alt={p.title} loading="lazy" />
        {p.images?.[1] && (
          <img
            className="gala-alt-image"
            src={p.images[1].url}
            alt=""
            loading="lazy"
          />
        )}
      </div>
      <button
        type="button"
        className="pcard-wish"
        aria-label={t("Save ", "حفظ ") + p.title}
        aria-pressed={ids.includes(p.id)}
        onClick={(e) => {
          e.preventDefault();
          toggle(p.id);
        }}
      >
        <Heart size={17} fill={ids.includes(p.id) ? "currentColor" : "none"} />
      </button>
      <div className="pcard-body">
        <h3>{p.title}</h3>
        <div className="pcard-price">
          <Price product={p} />
        </div>
      </div>
    </Link>
  );
}
export function Rail({ children, className = "" }) {
  const ref = useRef();
  const { t } = useGala();
  return (
    <div className="bz-rnav gala-rail">
      <div
        className={"bz-rail " + className}
        style={{ "--bz-cr": 1 }}
        ref={ref}
      >
        {children}
      </div>
      <button
        className="gala-rail-prev"
        aria-label={t("Scroll left", "تمرير لليسار")}
        onClick={() => ref.current.scrollBy({ left: -400, behavior: "smooth" })}
      >
        <ArrowLeft size={16} />
      </button>
      <button
        className="gala-rail-next"
        aria-label={t("Scroll right", "تمرير لليمين")}
        onClick={() => ref.current.scrollBy({ left: 400, behavior: "smooth" })}
      >
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
export function Header() {
  const { store, config, collections, products, pick, t, setCartOpen } =
      useGala(),
    { cartItems } = useCart(),
    { ids } = useSaved(),
    { language, setLanguage } = useLanguage();
  const [menu, setMenu] = useState(false),
    [mega, setMega] = useState(""),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState(""),
    [results, setResults] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ref = useRef(),
    location = useLocation();
  useDialog(menu, ref, () => setMenu(false));
  useEffect(() => {
    setMenu(false);
    setMega("");
    setSearch(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (!search) return;
    let alive = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setBusy(true);
      getProducts({ search: query, signal: controller.signal })
        .then((r) => {
          if (alive) {
            setResults(r.products);
            setError("");
          }
        })
        .catch((e) => {
          if (alive && e.name !== "AbortError") setError(e.message);
        })
        .finally(() => alive && setBusy(false));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, search]);
  useEffect(() => {
    const close = (e) => {
      if (e.key === "Escape") {
        setMega("");
        setSearch(false);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  const nav = (mobile = false) =>
    config.navigation.map((n, i) => (
      <div
        className={
          "gala-nav-item mega-trigger " + (mega === n.menu ? "open" : "")
        }
        key={i}
        onMouseEnter={() => !mobile && setMega(n.menu)}
        onMouseLeave={() => !mobile && setMega("")}
      >
        <Link to={n.path}>{pick(n.label)}</Link>
        {n.menu && (
          <button
            aria-label={pick(n.label) + " menu"}
            aria-expanded={mega === n.menu}
            onClick={() => setMega(mega === n.menu ? "" : n.menu)}
          >
            <ChevronDown size={11} />
          </button>
        )}
        {n.menu && mega === n.menu && !mobile && (
          <div className="mega-menu" style={{ display: "block" }}>
            <div
              className={
                "mega-inner container " +
                (n.menu === "products" ? "mega-has-side" : "")
              }
            >
              <div className="mega-cols">
                {collections.map((c) => (
                  <Link
                    className="mega-c"
                    key={c.id}
                    to={"/shop?collection=" + c.id}
                  >
                    <span className="mega-c-pic">
                      <img src={c.image} alt="" />
                    </span>
                    <span className="mega-c-name">
                      {language === "ar" ? c.nameAr || c.name : c.name}
                    </span>
                    <span className="mega-c-count">
                      {c.count}{" "}
                      {t(c.count === 1 ? "product" : "products", "منتج")}
                    </span>
                  </Link>
                ))}
                <Link className="mega-c mega-c-all" to="/collections">
                  {t("All collections", "كل المجموعات")} →
                </Link>
              </div>
              {n.menu === "products" && (
                <div className="mega-side">
                  <div className="mega-new">
                    <h4>{t("New arrivals", "وصل حديثًا")}</h4>
                    {products.slice(0, 4).map((p) => (
                      <Link
                        className="mega-p"
                        to={"/product/" + p.id}
                        key={p.id}
                      >
                        <img src={p.image} alt="" />
                        <span>
                          {p.title}
                          <small>
                            <Price product={p} />
                          </small>
                        </span>
                      </Link>
                    ))}
                  </div>
                  <Link className="mega-all-products" to="/shop">
                    {t("All products", "كل المنتجات")} →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    ));
  return (
    <>
      {store.brand.announcement.enabled && (
        <Link className="announce-bar" to={store.brand.announcement.link}>
          {language === "ar"
            ? store.brand.announcement.textAr || store.brand.announcement.text
            : store.brand.announcement.text}
        </Link>
      )}
      <header className="th-header th-header-split">
        <div className="header-inner container th-hdr-3col">
          <nav
            className="nav-links nav-left"
            aria-label={t("Main navigation", "التنقل الرئيسي")}
          >
            {nav()}
          </nav>
          <Link to="/" className="logo">
            <span className="logo-text">
              {store.brand.logo ? (
                <img
                  className="logo-img"
                  src={store.brand.logo}
                  alt={store.name}
                />
              ) : (
                store.name
              )}
            </span>
          </Link>
          <div className="header-actions">
            <button
              className="search-btn"
              aria-label={t("Search", "بحث")}
              aria-expanded={search}
              onClick={() => {
                setSearch(!search);
                setMega("");
              }}
            >
              <Search size={19} />
            </button>
            <Link
              className="acct-btn"
              to="/account"
              aria-label={t("Your account", "حسابك")}
            >
              <UserRound size={19} />
            </Link>
            <Link
              className="wish-btn"
              to="/saved"
              aria-label={t("Wishlist", "المفضلة")}
            >
              <Heart size={19} />
            </Link>
            <button
              className="cart-btn"
              aria-label={t("Cart", "السلة")}
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart size={19} />
              {cartItems.length > 0 && (
                <span className="cart-count" style={{ display: "flex" }}>
                  {cartItems.reduce((n, i) => n + i.quantity, 0)}
                </span>
              )}
            </button>
            <button
              className="menu-btn"
              aria-label={t("Menu", "القائمة")}
              onClick={() => setMenu(true)}
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
        {search && (
          <div className="search-overlay open">
            <div className="container">
              <div className="gala-search-row">
                <Search size={20} />
                <input
                  className="search-input"
                  aria-label={t("Search products", "ابحث عن منتج")}
                  placeholder={t("Search products...", "ابحث عن منتج...")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
                <button
                  onClick={() => setSearch(false)}
                  aria-label={t("Close search", "إغلاق البحث")}
                >
                  <X size={20} />
                </button>
              </div>
              <div id="search-results">
                {busy ? (
                  <p>{t("Searching…", "جارٍ البحث…")}</p>
                ) : error ? (
                  <p role="alert">{error}</p>
                ) : (
                  results.map((p) => (
                    <Link
                      className="sr-item"
                      to={"/product/" + p.id}
                      key={p.id}
                    >
                      <img src={p.image} alt="" />
                      <span>{p.title}</span>
                      <Price product={p} />
                    </Link>
                  ))
                )}
                {query && !busy && !results.length && !error && (
                  <p className="sr-empty">
                    {t(
                      "No products match your search",
                      "لا توجد منتجات مطابقة",
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
      {menu && (
        <div className="gala-mobile-overlay" onClick={() => setMenu(false)}>
          <div
            className="gala-mobile-panel"
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={t("Navigation menu", "قائمة التنقل")}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="gala-close"
              aria-label={t("Close menu", "إغلاق القائمة")}
              onClick={() => setMenu(false)}
            >
              <X />
            </button>
            {nav(true)}
            <div className="gala-mobile-collections">
              {collections.map((c) => (
                <Link key={c.id} to={"/shop?collection=" + c.id}>
                  {language === "ar" ? c.nameAr || c.name : c.name}
                </Link>
              ))}
            </div>
            <Link to="/contact">{t("Contact", "تواصل معنا")}</Link>
            <Link to="/account">{t("Account", "الحساب")}</Link>
            <button
              onClick={() => {
                setMenu(false);
                setCartOpen(true);
              }}
            >
              {t("Cart", "السلة")}
            </button>
            <button
              onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
            >
              {language === "ar" ? "English" : "العربية"}
            </button>
          </div>
        </div>
      )}
      {config.mobileNavigation && (
        <nav
          className="gala-bottom-nav"
          aria-label={t("Quick navigation", "التنقل السريع")}
        >
          {[
            [Home, "/", t("Home", "الرئيسية")],
            [Grid2X2, "/shop", t("Shop", "تسوق")],
            [Heart, "/saved", t("Saved", "المفضلة")],
          ].map(([Icon, url, label]) => (
            <Link
              to={url}
              key={url}
              aria-current={location.pathname === url ? "page" : undefined}
            >
              <Icon size={18} />
              <span>
                {label}
                {url === "/saved" && ids.length ? " " + ids.length : ""}
              </span>
            </Link>
          ))}
          <button onClick={() => setCartOpen(true)}>
            <ShoppingCart size={18} />
            <span>{t("Cart", "السلة")}</span>
          </button>
        </nav>
      )}
    </>
  );
}
export function Footer() {
  const { store, config, pick, t, currency, setCurrency, rates } = useGala(),
    { language, setLanguage } = useLanguage();
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <footer className="th-footer th-footer-newsletter">
      {config.newsletter.enabled && (
        <div className="container th-foot-nlband">
          <div>
            <h3>{pick(config.newsletter.title)}</h3>
            <p>{pick(config.newsletter.text)}</p>
          </div>
          <form
            className="nl-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setStatus("");
              try {
                await api(
                  "/newsletter",
                  jsonRequest("POST", {
                    email: new FormData(e.currentTarget).get("email"),
                    consent: true,
                  }),
                );
                setStatus(
                  t("You are subscribed. Thank you.", "تم الاشتراك، شكرًا لك."),
                );
                e.target.reset();
              } catch (e) {
                setStatus(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              type="email"
              name="email"
              required
              aria-label={t(
                "Email address for newsletter",
                "البريد للنشرة البريدية",
              )}
              placeholder={t("Enter your email", "أدخل بريدك الإلكتروني")}
            />
            <button className="nl-btn" disabled={busy}>
              {t("Subscribe", "اشترك")}
            </button>
            <span role="status">{status}</span>
          </form>
        </div>
      )}
      <div className="footer-inner container">
        <div className="footer-col footer-brand">
          <h4>{store.name}</h4>
          <p>{store.footer.text}</p>
          <div className="footer-social">
            {store.footer.socials.map((s, i) => (
              <a href={s.path} key={i} rel="noreferrer" target="_blank">
                {s.label}
              </a>
            ))}
          </div>
        </div>
        {config.footerColumns.map((col, i) => (
          <div className="footer-col" key={i}>
            <h4>{pick(col.title)}</h4>
            {col.links.map((l, j) => (
              <Link to={l.path} key={j}>
                {pick(l.label)}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="footer-bottom container">
        <span>
          © {new Date().getFullYear()} {store.name}. {store.footer.rights}
        </span>
        <span className="gala-powered">{t("Powered by", "بواسطة")} VÉRA</span>
        <div className="gala-footer-controls">
          {config.currency.enabled && (
            <label>
              {t("Currency", "العملة")}{" "}
              <select
                className="bz-cur-switch"
                title={t(
                  "Display currency — orders are charged in " +
                    store.checkout.currency,
                  "عملة العرض — يتم الدفع بعملة " + store.checkout.currency,
                )}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {[
                  ...new Set([
                    store.checkout.currency,
                    ...config.currency.codes,
                  ]),
                ]
                  .filter(
                    (c) => c === store.checkout.currency || rates?.rates[c],
                  )
                  .map((c) => (
                    <option key={c}>{c}</option>
                  ))}
              </select>
            </label>
          )}
          <button
            className="gala-language"
            onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
          >
            {language === "ar" ? "English" : "العربية"}
          </button>
        </div>
      </div>
    </footer>
  );
}
export function Cart() {
  const { cartOpen, setCartOpen, t, money, config, products, store } =
      useGala(),
    { cartItems, updateQuantity, removeFromCart } = useCart();
  const ref = useRef(),
    location = useLocation();
  useDialog(cartOpen, ref, () => setCartOpen(false));
  useEffect(() => setCartOpen(false), [location.pathname, setCartOpen]);
  const total = cartItems.reduce(
    (n, i) =>
      n +
      (i.variant.sale_price_in_cents ?? i.variant.price_in_cents) * i.quantity,
    0,
  );
  if (!cartOpen) return null;
  return (
    <div
      className="bz-cart-ui mode-drawer open"
      onClick={() => setCartOpen(false)}
    >
      <div className="bz-cart-backdrop" />
      <aside
        className="bz-cart-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t("Shopping cart", "سلة التسوق")}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bz-cart-head">
          <h2>{t("Your Cart", "سلتك")}</h2>
          <button
            className="bz-cart-x"
            aria-label={t("Close cart", "إغلاق السلة")}
            onClick={() => setCartOpen(false)}
          >
            <X />
          </button>
        </div>
        <div className="bz-cart-body">
          {cartItems.length === 0 ? (
            <div className="gala-empty">
              <ShoppingCart />
              <h3>{t("Your cart is empty", "سلتك فارغة")}</h3>
              <p>
                {t(
                  "Add some products to get started!",
                  "أضف منتجاتك المفضلة للبدء!",
                )}
              </p>
              <Link
                className="hero-btn primary"
                to="/shop"
                onClick={() => setCartOpen(false)}
              >
                {t("Continue Shopping", "متابعة التسوق")}
              </Link>
            </div>
          ) : (
            <>
              {cartItems.map((i) => (
                <div className="gala-cart-line" key={i.variant.id}>
                  <Link to={"/product/" + i.product.id}>
                    <img
                      src={i.variant.image_url || i.product.image}
                      alt={i.product.title}
                    />
                  </Link>
                  <div>
                    <Link to={"/product/" + i.product.id}>
                      {i.product.title} — {i.variant.title}
                    </Link>
                    <p>
                      {money(
                        i.variant.sale_price_in_cents ??
                          i.variant.price_in_cents,
                      )}
                    </p>
                    <div className="gala-qty">
                      <button
                        aria-label={t("Reduce quantity", "تقليل الكمية")}
                        onClick={() =>
                          updateQuantity(i.variant.id, i.quantity - 1)
                        }
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        aria-label={t("Quantity", "الكمية")}
                        min="1"
                        max={
                          i.variant.manage_inventory
                            ? i.variant.inventory_quantity
                            : 99
                        }
                        value={i.quantity}
                        onChange={(e) =>
                          updateQuantity(
                            i.variant.id,
                            Math.max(1, Number(e.target.value) || 1),
                          )
                        }
                      />
                      <button
                        aria-label={t("Increase quantity", "زيادة الكمية")}
                        onClick={() =>
                          updateQuantity(i.variant.id, i.quantity + 1)
                        }
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                  <div>
                    {money(
                      (i.variant.sale_price_in_cents ??
                        i.variant.price_in_cents) * i.quantity,
                    )}
                    <button
                      aria-label={t("Remove", "إزالة")}
                      onClick={() => removeFromCart(i.variant.id)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {config.cart.shippingProgress &&
                store.commerce.freeShippingOverInCents > 0 && (
                  <p>
                    {total >= store.commerce.freeShippingOverInCents
                      ? t(
                          "Your order qualifies for free shipping",
                          "طلبك مؤهل للشحن المجاني",
                        )
                      : t("Add ", "أضف ") +
                        money(store.commerce.freeShippingOverInCents - total) +
                        t(" for free shipping", " للشحن المجاني")}
                  </p>
                )}
              {config.cart.notes && (
                <label>
                  {t("Order note", "ملاحظة الطلب")}
                  <textarea
                    maxLength={500}
                    defaultValue={
                      sessionStorage.getItem(storeKey("gala-note")) || ""
                    }
                    onChange={(e) =>
                      sessionStorage.setItem(
                        storeKey("gala-note"),
                        e.target.value,
                      )
                    }
                  />
                </label>
              )}
              <div className="gala-cart-total">
                <b>{t("Total", "الإجمالي")}</b>
                <b>{money(total)}</b>
              </div>
              <Link to="/shop" onClick={() => setCartOpen(false)}>
                {t("Continue Shopping", "متابعة التسوق")}
              </Link>
              <Link
                className="btn-checkout-main"
                to="/checkout"
                onClick={() => setCartOpen(false)}
              >
                {t("Proceed to checkout", "إتمام الطلب")}
              </Link>
              <div className="gala-cart-trust">
                <span>
                  <LockKeyhole size={17} />
                  {t("Secure Checkout", "دفع آمن")}
                </span>
                <span>
                  <Truck size={17} />
                  {t("Order Tracking", "تتبع الطلب")}
                </span>
                <span>
                  <RotateCcw size={17} />
                  {t("Refund Policy", "سياسة الاسترجاع")}
                </span>
              </div>
              {config.cart.recommendations && (
                <div className="gala-cart-recommend">
                  <h3>{t("You may also like", "قد يعجبك أيضًا")}</h3>
                  <Rail>
                    {products
                      .filter(
                        (p) => !cartItems.some((i) => i.product.id === p.id),
                      )
                      .slice(0, 4)
                      .map((p) => (
                        <div key={p.id}>
                          <img src={p.image} alt="" />
                          <span>{p.title}</span>
                          <Price product={p} />
                          <Link to={"/product/" + p.id}>
                            {t("Choose", "اختر")}
                          </Link>
                        </div>
                      ))}
                  </Rail>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
