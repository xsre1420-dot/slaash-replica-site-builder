import { memo, useMemo } from "react";
import { Plus, Minus, Star, ShoppingBag, Sparkles, Flame } from "lucide-react";
import { Product } from "@/types";
import { getAvailableQty, hasVariantOptions } from "@/utils/inventoryUtils";
import OptimizedImage from "@/components/OptimizedImage";
import ProductPriceDisplay from "@/components/storefront/ProductPriceDisplay";
import { getProductListingBlurb, getProductOptionSummary } from "@/lib/storefrontProductDisplay";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  viewMode: "grid" | "list";
  cartQuantity: number;
  onAddToCart: (product: Product) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onView: (id: string) => void;
  onShare: (product: Product) => void;
  index: number;
}

const ProductCard = memo(({
  product,
  viewMode,
  cartQuantity,
  onAddToCart,
  onUpdateQuantity,
  onView,
  index,
}: ProductCardProps) => {
  const availableQty = useMemo(() => getAvailableQty(product), [product]);
  const isAboveFold = index < 4;
  const isLcpCandidate = index === 0;

  const { isNew, isLowStock, isOutOfStock, hasVariants, blurb, optionSummary } = useMemo(() => ({
    isNew: (product as any).created_at ? (Date.now() - new Date((product as any).created_at).getTime()) < 7 * 86400000 : false,
    isLowStock: availableQty > 0 && availableQty <= 3,
    isOutOfStock: availableQty <= 0,
    hasVariants: hasVariantOptions(product),
    blurb: getProductListingBlurb(product, 90),
    optionSummary: getProductOptionSummary(product),
  }), [product, availableQty]);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasVariants) {
      onView(product.id);
      return;
    }
    onAddToCart(product);
  };

  const enterStyle = { ['--sf-stagger' as string]: index } as React.CSSProperties;

  if (viewMode === "list") {
    return (
      <article
        className={cn(
          "sf-card sf-card-hover group flex gap-4 p-4 cursor-pointer sf-enter",
          cartQuantity > 0 && "border-primary/20"
        )}
        style={enterStyle}
        onClick={() => onView(product.id)}
      >
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden shrink-0 sf-surface">
          <OptimizedImage
            src={product.image}
            alt={product.name}
            variant="thumbnail"
            className="w-full h-full object-contain p-2 group-hover:scale-[1.03] transition-transform duration-500 ease-out"
            loading={isAboveFold ? "eager" : "lazy"}
            fetchPriority={isLcpCandidate ? "high" : undefined}
            sizes="128px"
          />
          {isOutOfStock && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
              <span className="text-[10px] font-bold text-muted-foreground">نفذ</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div className="space-y-1.5">
            <h3 className="font-semibold text-sm sm:text-base text-foreground text-right line-clamp-2 leading-snug">
              {product.name}
            </h3>
            {blurb && (
              <p className="text-xs text-muted-foreground/90 text-right line-clamp-2 leading-relaxed">{blurb}</p>
            )}
            {optionSummary && (
              <p className="text-[10px] text-muted-foreground/70 text-right">{optionSummary}</p>
            )}
            {product.rating != null && product.rating > 0 && (
              <div className="flex items-center justify-end gap-1">
                <span className="text-xs font-medium text-muted-foreground">{product.rating.toFixed(1)}</span>
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 mt-3" dir="rtl">
            <ProductPriceDisplay product={product} size="md" align="right" showBadge />
            {cartQuantity > 0 && !hasVariants ? (
              <div className="flex items-center gap-1 bg-primary/10 rounded-xl h-10 px-2 border border-primary/15 animate-cart-pop">
                <button onClick={(e) => { e.stopPropagation(); onUpdateQuantity(product.id, cartQuantity - 1); }} className="sf-product-qty-btn">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-primary w-6 text-center tabular-nums">{cartQuantity}</span>
                <button onClick={(e) => { e.stopPropagation(); onUpdateQuantity(product.id, cartQuantity + 1); }} className="sf-product-qty-btn">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleQuickAdd}
                disabled={isOutOfStock}
                className="sf-btn-primary h-10 px-4 text-xs disabled:opacity-50"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                {isOutOfStock ? "نفذ" : hasVariants ? "اختر" : "أضف"}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "sf-product-card sf-enter group",
        cartQuantity > 0 && !hasVariants && "sf-product-card--in-cart"
      )}
      style={enterStyle}
      onClick={() => onView(product.id)}
    >
      <div className="sf-product-image-wrap">
        <OptimizedImage
          src={product.image}
          alt={product.name}
          variant="thumbnail"
          className="sf-product-image"
          loading={isAboveFold ? "eager" : "lazy"}
          fetchPriority={isLcpCandidate ? "high" : undefined}
          sizes="(max-width: 640px) 45vw, 280px"
        />

        <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
          {isNew && (
            <span className="sf-badge bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="w-3 h-3 ml-0.5" /> جديد
            </span>
          )}
          {isLowStock && (
            <span className="sf-badge bg-warning/90 text-warning-foreground">
              <Flame className="w-3 h-3 ml-0.5" /> {availableQty}
            </span>
          )}
          {isOutOfStock && (
            <span className="sf-badge bg-foreground/75 text-background">نفذ</span>
          )}
        </div>
      </div>

      <div className="sf-product-body">
        <h3 className="sf-product-name">{product.name}</h3>
        <div className="flex items-end justify-between gap-2 w-full pt-0.5" dir="rtl">
          <ProductPriceDisplay product={product} size="sm" align="right" showBadge />
          {product.rating != null && product.rating > 0 ? (
            <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{product.rating.toFixed(1)}</span>
            </div>
          ) : null}
        </div>
      </div>

      {cartQuantity > 0 && !hasVariants ? (
        <div
          className="sf-product-qty-bar animate-cart-pop"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onUpdateQuantity(product.id, cartQuantity - 1)}
            className="sf-product-qty-btn"
            aria-label="تقليل الكمية"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-xs sm:text-sm font-semibold text-primary tabular-nums">{cartQuantity} في السلة</span>
          <button
            onClick={() => onUpdateQuantity(product.id, cartQuantity + 1)}
            className="sf-product-qty-btn"
            aria-label="زيادة الكمية"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleQuickAdd}
          disabled={isOutOfStock}
          className="sf-product-cta"
        >
          <ShoppingBag className="w-4 h-4 sf-product-cta-icon" strokeWidth={2} />
          {isOutOfStock ? "نفذ المخزون" : hasVariants ? "عرض الخيارات" : "أضف إلى السلة"}
        </button>
      )}
    </article>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
