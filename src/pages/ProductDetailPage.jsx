import Recommendations from "@/components/commerce/Recommendations";
import { useSaved } from "@/templates/form/FormShell";
import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import React, { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getProduct } from "@/api/store";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast.js";
import { useStore } from "@/hooks/useStore";
import ShoppingCartPanel from "@/components/ShoppingCart";
import { CustomToastContent } from "@/components/CustomToast.jsx";
import {
  ShoppingCart,
  Loader2,
  ArrowLeft,
  CheckCircle,
  Minus,
  Plus,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
const placeholderImage =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzc0MTUxIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K";
function ProductDetailPage() {
  const { ids, toggle } = useSaved();
  const { t, language } = useLanguage();
  const { id } = useParams();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { store } = useStore();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { addToCart, cartItems } = useCart();
  const inBag =
    cartItems.find((item) => item.variant.id === selectedVariant?.id)
      ?.quantity || 0;
  const quantityLimit = Math.max(
    0,
    Math.min(
      99,
      selectedVariant?.manage_inventory
        ? selectedVariant.inventory_quantity
        : 99,
    ) - inBag,
  );
  const effectiveQuantity = Math.min(quantity, Math.max(1, quantityLimit));
  const { toast } = useToast();
  const handleAddToCart = useCallback(async () => {
    if (product && selectedVariant) {
      const availableQuantity = selectedVariant.inventory_quantity;
      try {
        await addToCart(
          product,
          selectedVariant,
          effectiveQuantity,
          availableQuantity,
        );
        toast({
          duration: 4500,
          description: (
            <CustomToastContent
              productName={product.title}
              quantity={effectiveQuantity}
              productImage={product.image || selectedVariant?.image_url}
              onViewCart={() => window.dispatchEvent(new Event("open-cart"))}
            />
          ),
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Oh no! Something went wrong.",
          description: error.message,
        });
      }
    }
  }, [product, selectedVariant, effectiveQuantity, addToCart, toast]);
  const handleQuantityChange = (amount) => {
    setQuantity(
      Math.max(1, Math.min(quantityLimit, effectiveQuantity + amount)),
    );
  };
  const handlePrevImage = useCallback(() => {
    if (product?.images?.length > 1) {
      setCurrentImageIndex((prev) =>
        prev === 0 ? product.images.length - 1 : prev - 1,
      );
    }
  }, [product?.images?.length]);
  const handleNextImage = useCallback(() => {
    if (product?.images?.length > 1) {
      setCurrentImageIndex((prev) =>
        prev === product.images.length - 1 ? 0 : prev + 1,
      );
    }
  }, [product?.images?.length]);
  const handleVariantSelect = useCallback(
    (variant) => {
      setSelectedVariant(variant);
      setQuantity(1);
      if (variant.image_url && product?.images?.length > 0) {
        const imageIndex = product.images.findIndex(
          (image) => image.url === variant.image_url,
        );
        if (imageIndex !== -1) {
          setCurrentImageIndex(imageIndex);
        }
      }
    },
    [product?.images],
  );
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setCurrentImageIndex(0);
    setQuantity(1);
    getProduct(id, { signal: controller.signal })
      .then((fetched) => {
        if (controller.signal.aborted) return;
        setProduct(fetched);
        const variant =
          fetched.variants.find(
            (v) => !v.manage_inventory || v.inventory_quantity > 0,
          ) || fetched.variants[0];
        setSelectedVariant(variant);
        const imageIndex = fetched.images.findIndex(
          (image) => image.url === variant?.image_url,
        );
        setCurrentImageIndex(Math.max(0, imageIndex));
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err.message || "Failed to load product");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, language]);
  if (loading) {
    return localizeView(
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
      </div>,
      t,
    );
  }
  if (error || !product) {
    return localizeView(
      <div className="max-w-5xl mx-auto px-4 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Go back
        </Link>
        <div className="text-center text-destructive p-12 bg-destructive/5 rounded-2xl border border-destructive/10">
          <XCircle className="mx-auto h-12 w-12 mb-4 opacity-80" />
          <p className="text-lg">Error loading product: {error}</p>
        </div>
      </div>,
      t,
    );
  }
  const price =
    selectedVariant?.sale_price_formatted ?? selectedVariant?.price_formatted;
  const originalPrice = selectedVariant?.price_formatted;
  const availableStock = selectedVariant
    ? selectedVariant.inventory_quantity
    : 0;
  const isStockManaged = selectedVariant?.manage_inventory ?? false;
  const canAddToCart = !!selectedVariant && quantityLimit > 0;
  const currentImage = product.images[currentImageIndex];
  const hasMultipleImages = product.images.length > 1;
  return localizeView(
    <>
      <Helmet>
        <title>
          {product.title} - {store.name}
        </title>
        <meta
          name="description"
          content={product.description?.substring(0, 160) || product.title}
        />
      </Helmet>
      <ShoppingCartPanel
        isCartOpen={isCartOpen}
        setIsCartOpen={setIsCartOpen}
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Back to Collection
        </Link>

        <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
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
            }}
            className="relative"
          >
            <div className="relative overflow-hidden rounded-2xl bg-muted aspect-[4/5]">
              <img
                src={!currentImage?.url ? placeholderImage : currentImage.url}
                alt={product.title}
                className="w-full h-full object-cover"
              />

              {hasMultipleImages && (
                <>
                  <button
                    onClick={handlePrevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background text-foreground p-2.5 rounded-full shadow-sm transition-all"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={handleNextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background text-foreground p-2.5 rounded-full shadow-sm transition-all"
                    aria-label="Next image"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}

              {product.ribbon_text && (
                <div className="absolute top-6 left-6 bg-primary text-primary-foreground text-xs font-medium px-4 py-1.5 rounded-full shadow-sm tracking-wide uppercase">
                  {product.ribbon_text}
                </div>
              )}
            </div>

            {hasMultipleImages && (
              <div className="flex gap-3 mt-6 overflow-x-auto pb-2 scrollbar-hide">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    aria-label={`${t("Product image")} ${index + 1}`}
                    aria-pressed={index === currentImageIndex}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`flex-shrink-0 w-20 h-24 rounded-lg overflow-hidden border-2 transition-all ${index === currentImageIndex ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-border"}`}
                  >
                    <img
                      src={!image.url ? placeholderImage : image.url}
                      alt={`${product.title} thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

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
              delay: 0.1,
            }}
            className="flex flex-col"
          >
            <button
              onClick={() => toggle(product.id)}
              aria-pressed={ids.includes(product.id)}
            >
              {language === "ar" ? "حفظ القطعة" : "Save piece"}{" "}
              {ids.includes(product.id) ? "♥" : "♡"}
            </button>
            <h1 className="text-4xl md:text-5xl font-semibold text-foreground mb-3">
              {product.title}
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              {product.subtitle}
            </p>

            <div className="flex items-baseline gap-4 mb-8 pb-8 border-b border-border">
              <span className="text-3xl font-medium text-foreground">
                {price}
              </span>
              {selectedVariant?.sale_price_in_cents != null && (
                <span className="text-xl text-muted-foreground line-through">
                  {originalPrice}
                </span>
              )}
            </div>

            <div
              className="prose prose-neutral dark:prose-invert max-w-none text-foreground/80 mb-8 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: product.description,
              }}
            />

            {product.variants.length > 1 && (
              <div className="mb-8">
                <h3 className="text-sm font-medium text-foreground mb-3 uppercase tracking-wider">
                  Select Style
                </h3>
                <div className="flex flex-wrap gap-3">
                  {product.variants.map((variant) => (
                    <Button
                      key={variant.id}
                      variant={
                        selectedVariant?.id === variant.id
                          ? "default"
                          : "outline"
                      }
                      aria-pressed={selectedVariant?.id === variant.id}
                      onClick={() => handleVariantSelect(variant)}
                      className={`transition-all ${selectedVariant?.id === variant.id ? "bg-primary hover:bg-[hsl(var(--primary-dark))] text-primary-foreground border-primary" : "border-border text-foreground hover:bg-muted"}`}
                    >
                      {variant.title}
                      {variant.manage_inventory &&
                      variant.inventory_quantity === 0
                        ? ` · ${t("Sold out")}`
                        : ""}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-6 mb-8">
              <div className="flex items-center border border-border rounded-lg p-1 bg-background">
                <Button
                  aria-label="Decrease quantity"
                  disabled={effectiveQuantity <= 1 || quantityLimit === 0}
                  onClick={() => handleQuantityChange(-1)}
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-foreground hover:bg-muted rounded-md"
                >
                  <Minus size={16} />
                </Button>
                <span className="w-12 text-center text-foreground font-medium">
                  {effectiveQuantity}
                </span>
                <Button
                  aria-label="Increase quantity"
                  disabled={effectiveQuantity >= quantityLimit}
                  onClick={() => handleQuantityChange(1)}
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-foreground hover:bg-muted rounded-md"
                >
                  <Plus size={16} />
                </Button>
              </div>
            </div>

            <div className="mt-auto pt-6">
              <Button
                onClick={handleAddToCart}
                size="lg"
                className="w-full store-cta font-medium py-6 text-lg rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canAddToCart || !product.purchasable}
              >
                <ShoppingCart className="h-5 w-5" />{" "}
                {availableStock === 0 && isStockManaged
                  ? t("Sold out")
                  : t("Add to Cart")}
              </Button>

              {isStockManaged && canAddToCart && product.purchasable && (
                <p className="text-sm text-muted-foreground mt-4 flex items-center justify-center gap-2">
                  <CheckCircle size={16} className="text-primary" />{" "}
                  {availableStock} in stock and ready to ship
                </p>
              )}

              {isStockManaged &&
                availableStock === 0 &&
                product.purchasable && (
                  <p className="text-sm text-destructive mt-4 flex items-center justify-center gap-2">
                    <XCircle size={16} /> Not enough stock. Only{" "}
                    {availableStock} left.
                  </p>
                )}

              {quantityLimit === 0 && inBag > 0 && availableStock > 0 && (
                <p
                  className="text-sm text-muted-foreground mt-4 text-center"
                  role="status"
                >
                  This style is already fully in your bag.
                </p>
              )}
              {!product.purchasable && (
                <p className="text-sm text-destructive mt-4 flex items-center justify-center gap-2">
                  <XCircle size={16} /> Currently unavailable
                </p>
              )}
            </div>

            {product.additional_info?.length > 0 && (
              <div className="mt-12 space-y-6 pt-8 border-t border-border">
                {[...product.additional_info]
                  .sort((a, b) => a.order - b.order)
                  .map((info) => (
                    <div key={info.id}>
                      <h3 className="text-base font-medium text-foreground mb-2 uppercase tracking-wider">
                        {info.title}
                      </h3>
                      <div
                        className="prose prose-neutral dark:prose-invert prose-sm text-muted-foreground"
                        dangerouslySetInnerHTML={{
                          __html: info.description,
                        }}
                      />
                    </div>
                  ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </>,
    t,
  );
}
export default ProductDetailPage;
