import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShoppingCart as ShoppingCartIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useCart } from "@/hooks/useCart.jsx";
import StoreMenu from "@/components/StoreMenu";
import ShoppingCart from "@/components/ShoppingCart.jsx";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
const Header = () => {
  const { t, language } = useLanguage();
  const location = useLocation();
  const { store } = useStore();
  const { cartItems } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const navLinks = [
    {
      path: "/",
      label: "Home",
    },
  ];
  useEffect(() => {
    const handleOpenCart = () => setIsCartOpen(true);
    window.addEventListener("open-cart", handleOpenCart);
    return () => window.removeEventListener("open-cart", handleOpenCart);
  }, []);
  return localizeView(
    <>
      <a href="#main-content" className="skip-link">
        {t("Skip to content")}
      </a>
      {store.brand?.announcement?.enabled &&
        (language === "ar"
          ? store.brand.announcement.textAr || store.brand.announcement.text
          : store.brand.announcement.text) && (
          <div className="store-announcement">
            <a href={store.brand.announcement.link}>
              {language === "ar"
                ? store.brand.announcement.textAr ||
                  store.brand.announcement.text
                : store.brand.announcement.text}
            </a>
          </div>
        )}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link to="/" className="flex min-w-0 items-center gap-3 group">
              <motion.div
                whileHover={{
                  scale: 1.05,
                }}
                transition={{
                  duration: 0.3,
                }}
              >
                {store.brand?.logo ? (
                  <img
                    className="store-wordmark"
                    src={store.brand.logo}
                    alt={store.name}
                  />
                ) : (
                  <span className="store-text-wordmark text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
                    {store.name}
                  </span>
                )}
              </motion.div>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative text-base font-medium transition-colors duration-300 ${location.pathname === link.path ? "text-primary" : "text-foreground hover:text-primary"}`}
                >
                  {link.label}
                  {location.pathname === link.path && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30,
                      }}
                    />
                  )}
                </Link>
              ))}
            </nav>

            <div className="store-header-actions flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCartOpen(true)}
                className="relative hover:bg-muted transition-all duration-300"
                aria-label="Open shopping cart"
              >
                <ShoppingCartIcon className="h-5 w-5 text-foreground" />
                {itemCount > 0 && (
                  <motion.span
                    initial={{
                      scale: 0,
                    }}
                    animate={{
                      scale: 1,
                    }}
                    className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full h-5 w-5 flex items-center justify-center"
                  >
                    {itemCount}
                  </motion.span>
                )}
              </Button>
              <StoreMenu />
            </div>
          </div>
        </div>
      </header>

      <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />
    </>,
    t,
  );
};
export default Header;
