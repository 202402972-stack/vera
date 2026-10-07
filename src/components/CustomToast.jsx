import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import React from "react";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
export const CustomToastContent = ({
  productName,
  quantity = 1,
  productImage,
  onViewCart,
}) => {
  const { t } = useLanguage();
  return localizeView(
    <div className="flex items-center gap-4 w-full py-1">
      {productImage && (
        <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border border-border bg-muted">
          <img
            src={productImage}
            alt={productName}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="flex flex-col flex-grow min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground truncate">
          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="truncate">{productName}</span>
        </div>
        <span className="text-xs text-muted-foreground mt-0.5">
          Qty: {quantity} added to cart
        </span>
      </div>
      <Button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onViewCart) onViewCart();
        }}
        size="sm"
        className="flex-shrink-0 bg-primary hover:bg-[hsl(var(--primary-dark))] text-primary-foreground font-medium shadow-sm"
      >
        View Cart
      </Button>
    </div>,
    t,
  );
};
