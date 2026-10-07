import { storeUrl } from "@/lib/store-scope";
import useModal from "@/hooks/useModal";
import { useStore } from "@/hooks/useStore";
import { formatCurrency } from "@/api/store";
import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import React, { useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart as ShoppingCartIcon,
  X,
  Lock,
  ShieldCheck,
  CheckCircle,
  RotateCcw,
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
const ShoppingCart = ({ isCartOpen, setIsCartOpen }) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { store } = useStore();
  const modalRef = useModal(isCartOpen, () => setIsCartOpen(false));
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, getCartTotal, clearCart } =
    useCart();
  useEffect(() => {
    const handleOpenCart = () => setIsCartOpen(true);
    window.addEventListener("open-cart", handleOpenCart);
    return () => window.removeEventListener("open-cart", handleOpenCart);
  }, [setIsCartOpen]);
  const handleCheckout = useCallback(async () => {
    if (cartItems.length === 0) {
      toast({
        title: "Your cart is empty",
        description: "Add some products to your cart before checking out.",
        variant: "destructive",
      });
      return;
    }
    setIsCartOpen(false);
    navigate("/checkout");
  }, [cartItems, navigate, setIsCartOpen, toast]);
  return localizeView(
    <AnimatePresence>
      {isCartOpen && (
        <motion.div
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          exit={{
            opacity: 0,
          }}
          className="fixed inset-0 bg-foreground/60 z-50"
          onClick={() => setIsCartOpen(false)}
        >
          <motion.div
            initial={{
              x: language === "ar" ? "-100%" : "100%",
            }}
            animate={{
              x: 0,
            }}
            exit={{
              x: language === "ar" ? "-100%" : "100%",
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("Shopping Cart")}
            className="cart-panel absolute right-0 top-0 h-full w-full max-w-md bg-card text-card-foreground shadow-2xl flex flex-col rounded-l-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-2xl font-bold text-card-foreground">
                Shopping Cart
              </h2>
              <Button
                onClick={() => setIsCartOpen(false)}
                aria-label={t("Close cart")}
                variant="ghost"
                size="icon"
                className="text-card-foreground hover:bg-muted"
              >
                <X />
              </Button>
            </div>
            <div className="flex-grow p-6 overflow-y-auto space-y-4">
              {cartItems.length === 0 ? (
                <div className="text-center text-muted-foreground h-full flex flex-col items-center justify-center">
                  <ShoppingCartIcon size={48} className="mb-4 opacity-20" />
                  <p>Your cart is empty.</p>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div
                    key={item.variant.id}
                    className="flex items-center gap-4 bg-card border border-border p-3 rounded-lg"
                  >
                    <img
                      src={item.product.image}
                      alt={item.product.title}
                      className="w-20 h-20 object-cover rounded-md"
                    />
                    <div className="flex-grow">
                      <h3 className="font-semibold text-card-foreground">
                        {item.product.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {item.variant.title}
                      </p>
                      <p className="text-sm text-primary font-bold">
                        {item.variant.sale_price_formatted ??
                          item.variant.price_formatted}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center border border-border rounded-md">
                        <Button
                          onClick={() =>
                            updateQuantity(
                              item.variant.id,
                              Math.max(1, item.quantity - 1),
                            )
                          }
                          size="sm"
                          variant="ghost"
                          className="px-2 text-card-foreground hover:bg-muted"
                        >
                          -
                        </Button>
                        <span className="px-2 text-card-foreground">
                          {item.quantity}
                        </span>
                        <Button
                          onClick={() =>
                            updateQuantity(item.variant.id, item.quantity + 1)
                          }
                          size="sm"
                          variant="ghost"
                          className="px-2 text-card-foreground hover:bg-muted"
                        >
                          +
                        </Button>
                      </div>
                      <Button
                        onClick={() => removeFromCart(item.variant.id)}
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive/90 text-xs"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {cartItems.length > 0 && (
              <div className="p-6 border-t border-border bg-muted/30">
                <div className="flex justify-between items-center mb-4 text-card-foreground">
                  <span className="text-lg font-medium">Subtotal</span>
                  <span className="text-2xl font-bold">{getCartTotal()}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Delivery, discounts and tax are calculated at checkout.
                </p>
                {store.commerce?.freeShippingOverInCents != null && (
                  <DeliveryProgress
                    items={cartItems}
                    threshold={store.commerce.freeShippingOverInCents}
                    symbol={store.checkout.symbol}
                  />
                )}
                {store.commerce?.acceptingOrders === false && (
                  <p role="status" className="text-sm text-destructive mb-4">
                    The store is temporarily not accepting orders.
                  </p>
                )}
                <Button
                  disabled={store.commerce?.acceptingOrders === false}
                  onClick={handleCheckout}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 text-base mb-6"
                >
                  Proceed to Checkout
                </Button>

                <div className="pt-5 border-t border-border/60">
                  <p className="text-xs text-center text-muted-foreground mb-4 flex items-center justify-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Cash on delivery. Pay when
                    your order arrives.
                  </p>
                  <div className="flex gap-4 justify-center text-xs">
                    <a className="underline" href={storeUrl("/terms")}>
                      Terms & returns
                    </a>
                    <a className="underline" href={storeUrl("/contact")}>
                      Contact us
                    </a>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    t,
  );
};
function DeliveryProgress({ items, threshold, symbol }) {
  const { t } = useLanguage();
  const subtotal = items.reduce(
    (sum, i) =>
      sum +
      (i.variant.sale_price_in_cents ?? i.variant.price_in_cents) * i.quantity,
    0,
  );
  const left = Math.max(0, threshold - subtotal);
  return (
    <div className="cart-delivery-progress">
      {left
        ? `${formatCurrency(left, { symbol })} ${t("away from free delivery")}`
        : t("Your bag qualifies for free delivery.")}
      <progress
        max={Math.max(1, threshold)}
        value={Math.min(subtotal, Math.max(1, threshold))}
        aria-label={t("Free delivery progress")}
      />
      <small>{t("Calculated after discounts at checkout.")}</small>
    </div>
  );
}
export default ShoppingCart;
