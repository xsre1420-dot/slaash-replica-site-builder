import { Heart, Plus, Minus, Star, Share2, Flame, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product } from "@/types";
import { memo, useMemo } from "react";
import OptimizedImage from "@/components/OptimizedImage";

interface ProductCardProps {
  product: Product;
  viewMode: "grid" | "list";
  isFavorite: boolean;
  cartQuantity: number;
  onToggleFavorite: (id: string) => void;
  onAddToCart: (product: Product) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onView: (id: string) => void;
  onShare: (product: Product) => void;
  index: number;
}

const ProductCard = memo(({
  product,
  viewMode,
  isFavorite,
  cartQuantity,
  onToggleFavorite,
  onAddToCart,
  onUpdateQuantity,
  onView,
  onShare,
  index,
}: ProductCardProps) => {
  const { isNew, isLowStock, isOutOfStock, hasDiscount } = useMemo(() => ({
    isNew: (product as any).created_at ? (Date.now() - new Date((product as any).created_at).getTime()) < 7 * 86400000 : false,
    isLowStock: product.stockQuantity !== undefined && product.stockQuantity > 0 && product.stockQuantity <= 3,
    isOutOfStock: product.stockQuantity !== undefined && product.stockQuantity === 0,
    hasDiscount: product.discountType && product.discountType !== 'none',
  }), [product.stockQuantity, product.discountType, (product as any).created_at]);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShare(product);
  };

  const PriceBlock = ({ size = "sm" }: { size?: "sm" | "md" }) => (
    <div className="flex flex-col items-end leading-tight">
      {hasDiscount && product.originalPrice ? (
        <>
          <span className="text-[10px] text-muted-foreground line-through">{product.originalPrice.toLocaleString()}</span>
          <span className={`font-bold text-destructive ${size === "md" ? "text-base" : "text-sm"}`}>{product.price.toLocaleString()} د.ع</span>
        </>
      ) : (
        <span className={`font-bold text-foreground ${size === "md" ? "text-base" : "text-sm"}`}>{product.price.toLocaleString()} د.ع</span>
      )}
    </div>
  );

  if (viewMode === "list") {
    return (
      <div
        className="group bg-card rounded-2xl overflow-hidden border border-border/60 hover:border-primary/30 hover:shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.18)] transition-all duration-300 cursor-pointer animate-fade-in flex gap-3 p-3"
        style={{ animationDelay: `${index * 30}ms` }}
        onClick={() => onView(product.id)}
      >
        <div className="relative w-28 h-28 rounded-xl overflow-hidden flex-shrink-0 bg-muted/40">
          <OptimizedImage src={product.image} alt={product.name} className="w-full h-full group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
            {hasDiscount && (
              <span className="bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-md text-[9px] font-bold shadow-sm">
                {product.discountType === 'percentage' ? `${product.discountValue}%-` : `${product.discountValue?.toLocaleString()}-`}
              </span>
            )}
            {isNew && (
              <span className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-0.5 shadow-sm">
                <Sparkles className="w-2.5 h-2.5" /> جديد
              </span>
            )}
          </div>
          <button
            className={`absolute top-1.5 left-1.5 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
              isFavorite ? 'bg-destructive text-destructive-foreground scale-110' : 'bg-card/80 text-muted-foreground hover:text-destructive'
            }`}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(product.id); }}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-right line-clamp-1 text-foreground">{product.name}</h3>
            <p className="text-xs text-muted-foreground text-right line-clamp-1 mt-0.5">{product.description}</p>
            <div className="flex items-center justify-end gap-1 mt-1.5">
              <span className="text-[10px] text-muted-foreground">{product.rating?.toFixed(1) || '4.5'}</span>
              <Star className="w-3 h-3 text-amber-400 fill-current" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5">
              <button onClick={handleShare} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                <Share2 className="w-3 h-3" />
              </button>
              {cartQuantity > 0 ? (
                <div className="flex items-center gap-1 bg-primary/10 rounded-xl px-1.5">
                  <button onClick={(e) => { e.stopPropagation(); onUpdateQuantity(product.id, cartQuantity + 1); }} className="p-1 text-primary"><Plus className="w-3.5 h-3.5" /></button>
                  <span className="text-xs font-bold text-primary w-5 text-center">{cartQuantity}</span>
                  <button onClick={(e) => { e.stopPropagation(); onUpdateQuantity(product.id, cartQuantity - 1); }} className="p-1 text-primary"><Minus className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <Button size="sm" className="h-7 text-[10px] rounded-xl bg-primary text-primary-foreground hover:bg-primary/90" onClick={(e) => { e.stopPropagation(); onAddToCart(product); }} disabled={isOutOfStock}>
                  <Plus className="w-3 h-3 ml-0.5" />
                  {isOutOfStock ? "نفذ" : "أضف"}
                </Button>
              )}
            </div>
            <PriceBlock />
          </div>
        </div>
      </div>
    );
  }

  // Grid view — premium card
  return (
    <div
      className="group relative bg-card rounded-2xl overflow-hidden border border-border/60 hover:border-primary/40 hover:shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.25)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer animate-fade-in"
      style={{ animationDelay: `${index * 30}ms` }}
      onClick={() => onView(product.id)}
    >
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-muted/40 to-muted/10">
        <OptimizedImage
          src={product.image}
          alt={product.name}
          className="w-full h-full group-hover:scale-110 transition-transform duration-700"
          loading="lazy"
        />
        {/* Soft gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-10">
          {hasDiscount && (
            <span className="bg-destructive text-destructive-foreground px-2 py-0.5 rounded-lg shadow-md text-[10px] font-bold">
              {product.discountType === 'percentage' ? `${product.discountValue}%-` : `${product.discountValue?.toLocaleString()}-`}
            </span>
          )}
          {isNew && (
            <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-lg shadow-md text-[10px] font-bold flex items-center gap-0.5">
              <Sparkles className="w-3 h-3" /> جديد
            </span>
          )}
          {isLowStock && (
            <span className="bg-warning text-warning-foreground px-2 py-0.5 rounded-lg shadow-md text-[10px] font-bold flex items-center gap-0.5">
              <Flame className="w-3 h-3" /> آخر {product.stockQuantity}
            </span>
          )}
          {isOutOfStock && (
            <span className="bg-foreground/80 text-background px-2 py-0.5 rounded-lg shadow-md text-[10px] font-bold backdrop-blur-sm">
              نفذ المخزون
            </span>
          )}
        </div>

        {/* Favorite & Share */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5 z-10">
          <button
            className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-sm ${
              isFavorite ? 'bg-destructive text-destructive-foreground scale-110' : 'bg-card/85 text-muted-foreground hover:text-destructive hover:scale-110'
            }`}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(product.id); }}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          <button
            className="w-8 h-8 rounded-full bg-card/85 backdrop-blur-md text-muted-foreground hover:text-primary hover:scale-110 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-sm"
            onClick={handleShare}
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <h3 className="font-semibold text-sm text-right line-clamp-1 text-foreground">{product.name}</h3>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-md">
            <Star className="w-3 h-3 text-amber-500 fill-current" />
            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">{product.rating?.toFixed(1) || '4.5'}</span>
          </div>
          <PriceBlock size="md" />
        </div>

        {cartQuantity > 0 ? (
          <div className="flex items-center justify-between bg-primary/10 rounded-xl h-9 px-2">
            <button onClick={(e) => { e.stopPropagation(); onUpdateQuantity(product.id, cartQuantity + 1); }} className="p-1 text-primary hover:bg-primary/20 rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-primary">{cartQuantity}</span>
            <button onClick={(e) => { e.stopPropagation(); onUpdateQuantity(product.id, cartQuantity - 1); }} className="p-1 text-primary hover:bg-primary/20 rounded-lg transition-colors">
              <Minus className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Button
            size="sm"
            className="w-full h-9 text-xs rounded-xl border-0 bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-sm hover:shadow-md font-semibold"
            onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
            disabled={isOutOfStock}
          >
            {isOutOfStock ? "نفذ المخزون" : (<><Plus className="w-3.5 h-3.5 ml-1" /> أضف للسلة</>)}
          </Button>
        )}
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
