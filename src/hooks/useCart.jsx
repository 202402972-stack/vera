import { storeKey } from "@/lib/store-scope";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { formatCurrency } from "@/api/store";
import { useLanguage } from "@/i18n/LanguageContext";
import { localizeProduct } from "@/i18n/content";
import { track } from "@/lib/analytics";

const CartContext = createContext();

const CART_STORAGE_KEY = storeKey("e-commerce-cart");

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const { language } = useLanguage();
  const [cartItems, setCartItems] = useState(() => {
    try {
      const storedCart = localStorage.getItem(CART_STORAGE_KEY);

      const parsed = storedCart ? JSON.parse(storedCart) : [];
      return Array.isArray(parsed)
        ? parsed
            .filter(
              (i) =>
                i?.product?.id &&
                Array.isArray(i.product.variants) &&
                i?.variant?.id &&
                Number.isInteger(i.quantity) &&
                i.quantity > 0 &&
                i.quantity <= 99,
            )
            .slice(0, 40)
        : [];
    } catch (error) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {}
  }, [cartItems]);

  const addToCart = useCallback(
    (product, variant, quantity, availableQuantity) => {
      return new Promise((resolve, reject) => {
        if (
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 99 ||
          (cartItems.find((i) => i.variant.id === variant.id)?.quantity || 0) +
            quantity >
            99
        ) {
          reject(new Error("The maximum quantity per style is 99."));
          return;
        }
        if (!product.purchasable) {
          reject(new Error("This product is currently unavailable."));
          return;
        }
        if (variant.manage_inventory) {
          const existingItem = cartItems.find(
            (item) => item.variant.id === variant.id,
          );
          const currentCartQuantity = existingItem ? existingItem.quantity : 0;
          if (currentCartQuantity + quantity > availableQuantity) {
            const error = new Error(
              `Not enough stock for ${product.title} (${variant.title}). Only ${availableQuantity} left.`,
            );
            reject(error);
            return;
          }
        }

        setCartItems((prevItems) => {
          const existingItem = prevItems.find(
            (item) => item.variant.id === variant.id,
          );
          if (existingItem) {
            return prevItems.map((item) =>
              item.variant.id === variant.id
                ? { ...item, quantity: item.quantity + quantity }
                : item,
            );
          }
          const canonical = product._base || product;
          return [
            ...prevItems,
            {
              product: canonical,
              variant:
                canonical.variants.find((v) => v.id === variant.id) || variant,
              quantity,
            },
          ];
        });
        track("add_to_cart", `${product.id}:${variant.id}`, quantity);
        resolve();
      });
    },
    [cartItems],
  );

  const removeFromCart = useCallback((variantId) => {
    track("remove_from_cart", variantId);
    setCartItems((prevItems) =>
      prevItems.filter((item) => item.variant.id !== variantId),
    );
  }, []);

  const updateQuantity = useCallback((variantId, quantity) => {
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.variant.id === variantId
          ? {
              ...item,
              quantity: Math.max(
                1,
                Math.min(
                  99,
                  item.variant.manage_inventory
                    ? item.variant.inventory_quantity
                    : 99,
                  quantity,
                ),
              ),
            }
          : item,
      ),
    );
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const getCartTotal = useCallback(() => {
    return formatCurrency(
      cartItems.reduce((total, item) => {
        const price =
          item.variant.sale_price_in_cents ?? item.variant.price_in_cents;
        return total + price * item.quantity;
      }, 0),
      cartItems[0]?.variant.currency_info || { symbol: "$", decimal_digits: 2 },
    );
  }, [cartItems]);

  const value = useMemo(
    () => ({
      cartItems: cartItems.map((item) => {
        const product = localizeProduct(item.product, language);
        return {
          ...item,
          product,
          variant:
            product.variants.find((v) => v.id === item.variant.id) ||
            item.variant,
        };
      }),
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getCartTotal,
    }),
    [
      language,
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getCartTotal,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
