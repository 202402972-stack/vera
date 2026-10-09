import { storeUrl } from "@/lib/store-scope";
import { useLocation, useNavigate } from "react-router-dom";
import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, Home, Languages, Layers, BookOpen, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

export default function StoreMenu() {
  const location = useLocation();
  const route = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const reducedMotion = useReducedMotion();
  const label = language === "ar" ? "قائمة المتجر" : "Store menu";
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const navigate = (event, section) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    close(true);
    if (
      ["contact", "shop", "saved", "account", "collections"].includes(section)
    ) {
      route("/" + section);
      return;
    }
    if (!section && location.pathname !== "/") {
      route("/");
      return;
    }
    if (section) {
      const target = document.getElementById(section);
      if (!target) {
        route(section === "story" ? "/about" : `/#${section}`);
        return;
      }
      target.scrollIntoView({
        behavior: reducedMotion ? "instant" : "smooth",
        block: "start",
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: reducedMotion ? "instant" : "smooth",
      });
    }
  };
  return (
    <div
      className="store-menu"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Button
        ref={trigger}
        type="button"
        variant="ghost"
        size="icon"
        className="store-menu-trigger hover:bg-muted transition-colors duration-300"
        aria-label={label}
        aria-expanded={open}
        aria-controls="store-menu-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <Menu className="h-5 w-5 text-foreground" />
      </Button>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="store-menu-panel"
            aria-label={label}
            className="store-menu-panel"
            dir={language === "ar" ? "rtl" : "ltr"}
            initial={{
              opacity: 0,
              y: reducedMotion ? 0 : -5,
              scale: reducedMotion ? 1 : 0.98,
            }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: reducedMotion ? 0 : -3,
              scale: reducedMotion ? 1 : 0.98,
            }}
            transition={{ duration: reducedMotion ? 0 : 0.18, ease: "easeOut" }}
          >
            <a
              href={storeUrl("/")}
              className="store-menu-item"
              onClick={(event) => navigate(event)}
            >
              <Home />
              {t("Home")}
            </a>
            <button
              type="button"
              className="store-menu-item"
              aria-label={
                language === "ar" ? "Switch to English" : "التبديل إلى العربية"
              }
              onClick={() => {
                setLanguage(language === "ar" ? "en" : "ar");
                close(true);
              }}
            >
              <Languages />
              <span lang={language === "ar" ? "en" : "ar"} dir="auto">
                {language === "ar" ? "English" : "العربية"}
              </span>
            </button>
            <div className="store-menu-divider" />
            {[
              ["shop", language === "ar" ? "الكتالوج" : "Shop", Layers],
              ["saved", language === "ar" ? "المفضلة" : "Saved", Layers],
              [
                "account",
                language === "ar" ? "الحساب والتتبع" : "Account & tracking",
                Home,
              ],
              [
                "collection",
                language === "ar" ? "المجموعة" : "Collection",
                Layers,
              ],
              ["story", t("Story"), BookOpen],
              ["contact", t("Contact"), Mail],
            ].map(([section, text, Icon]) => (
              <a
                key={section}
                href={storeUrl(
                  [
                    "contact",
                    "shop",
                    "saved",
                    "account",
                    "collections",
                  ].includes(section)
                    ? "/" + section
                    : `/#${section}`,
                )}
                className="store-menu-item"
                onClick={(event) => navigate(event, section)}
              >
                <Icon />
                {text}
              </a>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
