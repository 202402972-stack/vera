import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import React, {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Loader2, Search } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast.js";
import { api, getProducts } from "@/api/store";
import { CustomToastContent } from "@/components/CustomToast.jsx";
const placeholderImage =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzc0MTUxIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K";
const ProductCard = ({ product, index }) => {
  const { t } = useLanguage();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const available =
    product.purchasable &&
    product.variants.some(
      (v) => !v.manage_inventory || v.inventory_quantity > 0,
    );
  const displayVariant = useMemo(
    () =>
      product.variants?.find(
        (v) => !v.manage_inventory || v.inventory_quantity > 0,
      ) || product.variants?.[0],
    [product],
  );
  const hasSale = useMemo(
    () => displayVariant && displayVariant.sale_price_in_cents !== null,
    [displayVariant],
  );
  const displayPrice = useMemo(
    () =>
      hasSale
        ? displayVariant.sale_price_formatted
        : displayVariant?.price_formatted,
    [displayVariant, hasSale],
  );
  const originalPrice = useMemo(
    () => (hasSale ? displayVariant.price_formatted : null),
    [displayVariant, hasSale],
  );
  const handleAddToCart = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const defaultVariant = displayVariant;
      if (!defaultVariant) {
        toast({
          title: "Error",
          description: "This product is currently unavailable.",
          variant: "destructive",
        });
        return;
      }
      setAdding(true);
      try {
        await addToCart(
          product,
          defaultVariant,
          1,
          defaultVariant.inventory_quantity,
        );
        toast({
          duration: 4500,
          description: (
            <CustomToastContent
              productName={product.title}
              quantity={1}
              productImage={product.image || defaultVariant?.image_url}
              onViewCart={() => window.dispatchEvent(new Event("open-cart"))}
            />
          ),
        });
      } catch (error) {
        toast({
          title: "Error adding to cart",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setAdding(false);
      }
    },
    [product, displayVariant, addToCart, toast],
  );
  return localizeView(
    <motion.div
      initial={{
        opacity: 0,
        y: 20,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.5,
        delay: Math.min(index, 7) * 0.05,
      }}
      className="h-full"
    >
      <div className="flex flex-col h-full rounded-xl bg-card text-card-foreground overflow-hidden group transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border border-border/50">
        <Link to={`/product/${product.id}`} className="flex flex-col flex-grow">
          <div className="relative aspect-[4/5] overflow-hidden bg-muted">
            <img
              src={product.image || placeholderImage}
              alt={product.title}
              loading="lazy"
              decoding="async"
              width="800"
              height="1000"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-all duration-300" />
            {product.ribbon_text && (
              <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full shadow-sm tracking-wide uppercase">
                {product.ribbon_text}
              </div>
            )}
          </div>
          <div className="p-5 flex flex-col flex-grow">
            <div className="flex justify-between items-start gap-4 mb-2">
              <h3 className="text-lg font-medium text-foreground line-clamp-2">
                {product.title}
              </h3>
              <div className="text-right flex-shrink-0">
                {hasSale && (
                  <div className="text-sm text-muted-foreground line-through mb-0.5">
                    {originalPrice}
                  </div>
                )}
                <div className="font-medium text-foreground">
                  {displayPrice}
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-grow">
              {product.subtitle || "Handcrafted with care and precision."}
            </p>
          </div>
        </Link>
        <div className="px-5 pb-5 mt-auto">
          <Button
            disabled={!available || adding}
            onClick={handleAddToCart}
            className="w-full store-cta font-medium transition-colors"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />{" "}
            {available ? (adding ? "Adding…" : "Add to Cart") : "Out of stock"}
          </Button>
        </div>
      </div>
    </motion.div>,
    t,
  );
};
const ProductsList = () => {
  const { t, language } = useLanguage();
  const generation = useRef(0);
  const [collections,setCollections]=useState([]),[collection,setCollection]=useState("");
  useEffect(()=>{api("/collections").then(d=>setCollections(d.collections)).catch(()=>{});},[]);
  const [products, setProducts] = useState([]),
    [categories, setCategories] = useState([]);
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [sort, setSort] = useState("featured");
  const [hasMore, setHasMore] = useState(false),
    [total, setTotal] = useState(0),
    [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(null),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    api("/categories")
      .then((d) => setCategories(d.categories))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    generation.current += 1;
    setLoadingMore(false);
    setLoading(true);
    setError(null);
    getProducts({ search: query, category, collection, sort, signal: controller.signal })
      .then((data) => {
        setProducts(data.products);
        setHasMore(data.hasMore);
        setTotal(data.total);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [language, query, category, collection, sort, revision]);
  return localizeView(
    <>
      {collections.length>0&&<nav aria-label={language==='ar'?'المجموعات':'Collections'} className="flex flex-wrap gap-2 mb-5"><button className={`px-4 py-2 rounded-full border text-sm ${!collection?'bg-primary text-primary-foreground':'bg-background'}`} onClick={()=>setCollection('')}>{language==='ar'?'كل القطع':'All pieces'}</button>{collections.map(c=><button key={c.id} aria-pressed={collection===c.id} className={`px-4 py-2 rounded-full border text-sm ${collection===c.id?'bg-primary text-primary-foreground':'bg-background'}`} onClick={()=>setCollection(c.id)}>{language==='ar'?(c.nameAr||c.name):c.name} <span className="opacity-60">{c.count}</span></button>)}</nav>}
      {collection&&<p className="text-muted-foreground mb-5 text-sm">{language==='ar'?(collections.find(c=>c.id===collection)?.descriptionAr||collections.find(c=>c.id===collection)?.description):collections.find(c=>c.id===collection)?.description}</p>}
      <div className="catalogue-tools">
        <label className="catalogue-search">
          <Search size={18} />
          <input
            type="search"
            aria-label="Search collection"
            placeholder={t("Search the collection…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {categories.length > 0 && (
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Sort collection"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="featured">Featured</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="newest">Recently added</option>
        </select>
      </div>
      <div aria-live="polite" aria-busy={loading}>
        {loading ? (
          <div
            className="flex justify-center items-center h-64"
            role="status"
            aria-label={t("Loading…")}
          >
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center p-8" role="alert">
            <p>{error}</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => setRevision((v) => v + 1)}
            >
              Try again
            </Button>
          </div>
        ) : !products.length ? (
          <div className="text-center py-16">
            <h3 className="mb-3">No pieces found.</h3>
            <p className="text-muted-foreground mx-auto">
              Try another search or explore the full collection.
            </p>
            <Button
              className="mt-5"
              variant="outline"
              onClick={() => {
                setSearch("");
                setQuery("");
                setCategory("");setCollection("");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <>
            <p className="catalogue-count">
              {total} {t("pieces in the collection")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {products.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </div>
          </>
        )}
      </div>
      {!loading && !error && hasMore && (
        <div className="flex justify-center mt-10">
          <Button
            variant="outline"
            disabled={loadingMore}
            onClick={async () => {
              setLoadingMore(true);
              const currentGeneration = generation.current;
              try {
                const data = await getProducts({
                  offset: products.length,
                  search: query,
                  category,
                  collection,
                  sort,
                });
                if (currentGeneration !== generation.current) return;
                setProducts((old) => [...old, ...data.products]);
                setHasMore(data.hasMore);
              } catch (e) {
                if (currentGeneration === generation.current)
                  setError(e.message);
              } finally {
                if (currentGeneration === generation.current)
                  setLoadingMore(false);
              }
            }}
          >
            {loadingMore && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
            Load more products
          </Button>
        </div>
      )}
    </>,
    t,
  );
};
export default ProductsList;
