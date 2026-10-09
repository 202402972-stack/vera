import { useLanguage } from "@/i18n/LanguageContext";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import { StoreProvider } from "@/hooks/useStore";
import { CartProvider } from "@/hooks/useCart";
import { storeBase } from "@/lib/store-scope";
import TemplateRenderer from "./registry";
import StoreSEO from "@/components/StoreSEO";
export default function StoreRoot() {
  const { language } = useLanguage();
  return (
    <StoreProvider>
      <CartProvider>
        {storeBase.startsWith("/demo/") && (
          <aside className="text-center text-xs p-2 bg-stone-100 text-stone-700">
            {language === "ar"
              ? "معاينة القالب · الطلبات والحفظ غير متاحين هنا"
              : "Template preview · Orders and changes are disabled"}{" "}
            <a
              className="underline mx-2"
              href={
                "/login?intent=create&template=" +
                encodeURIComponent(storeBase.split("/")[2])
              }
            >
              {language === "ar" ? "أنشئ متجرك" : "Create your store"}
            </a>
          </aside>
        )}
        <BrowserRouter basename={storeBase || "/"}>
          <StoreSEO />
          <TemplateRenderer />
        </BrowserRouter>
      </CartProvider>
    </StoreProvider>
  );
}
