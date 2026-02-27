import { Heart, Plus, Minus, Star, Share2, ShoppingBag, Eye, Flame, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product } from "@/types";
import { useState, useRef } from "react";
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

const ProductCard = ({
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
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Badges logic
  const isNew = (product as any).created_at ? (Date.now() - new Date((product as any).created_at).getTime()) < 7 * 24 * 60 * 60 * 1000 : false;
  const isLowStock = product.stockQuantity !== undefined && product.stockQuantity > 0 && product.stockQuantity <= 3;
  const isOutOfStock = product.stockQuantity !== undefined && product.stockQuantity === 0;
  const hasDiscount = product.discountType && product.discountType !== 'none';

  // Social proof (simulated)
  const viewerCount = Math.floor(Math.random() * 5) + 1;

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onShare(product);
  };

  if (viewMode === "list") {
    return (
      <div
        className="bg-card rounded-2xl overflow-hidden border border-border/50 hover:border-primary/20 hover:shadow-md transition-all duration-300 cursor-pointer animate-fade-in flex gap-3 p-3"
        style={{ animationDelay: `${index * 30}ms` }}
        onClick={() => onView(product.id)}
      >
        {/* Image */}
        <div className="relative w-28 h-28 rounded-xl overflow-hidden flex-shrink-0">
          <OptimizedImage
            src={product.image}
            alt={product.name}
            className="w-full h-full"
            loading="lazy"
          />
          {/* Badges */}
          <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
            {hasDiscount && (
              <span className="bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-md text-[9px] font-bold">
                {product.discountType === 'percentage' ? `${product.discountValue}%-` : `${product.discountValue?.toLocaleString()}-`}
              </span>
            )}
            {isNew && (
              <span className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> جديد
              </span>
            )}
          </div>
          <button
            className={`absolute top-1.5 left-1.5 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
              isFavorite ? 'bg-destructive text-destructive-foreground scale-110' : 'bg-card/80 text-muted-foreground hover:text-destructive'
            }`}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(product.id); }}
          >
            <Heart className={`w-3 h-3 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-right line-clamp-1 text-foreground">{product.name}</h3>
            <p className="text-xs text-muted-foreground text-right line-clamp-1 mt-0.5">{product.description}</p>
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-[10px] text-muted-foreground">4.5</span>
              <Star className="w-3 h-3 text-amber-400 fill-current" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5">
              <button onClick={handleShare} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                <Share2 className="w-3 h-3" />
              </button>
              {cartQuantity > 0 ? (
                <div className="flex items-center gap-1 bg-primary/10 rounded-xl px-1.5">
                  <button onClick={(e) => { e.stopPropagation(); onUpdateQuantity(product.id, cartQuantity + 1); }} className="p-1 text-primary"><Plus className="w-3.5 h-3.5" /></button>
                  <span className="text-xs font-bold text-primary w-5 text-center">{cartQuantity}</span>
                  <button onClick={(e) => { e.stopPropagation(); onUpdateQuantity(product.id, cartQuantity - 1); }} className="p-1 text-primary"><Minus className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <Button size="sm" className="h-7 text-[10px] rounded-xl bg-primary text-primary-foreground" onClick={(e) => { e.stopPropagation(); onAddToCart(product); }} disabled={isOutOfStock}>
                  <Plus className="w-3 h-3 ml-0.5" />
                  {isOutOfStock ? "نفذ" : "أضف"}
                </Button>
              )}
            </div>
            <div className="text-right">
              {hasDiscount && product.originalPrice ? (
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-muted-foreground line-through">{product.originalPrice.toLocaleString()}</span>
                  <span className="text-sm font-bold text-destructive">{product.price.toLocaleString()} د.ع</span>
                </div>
              ) : (
                <span className="text-sm font-bold text-foreground">{product.price.toLocaleString()} د.ع</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      className="bg-card rounded-2xl overflow-hidden border border-border/50 hover:border-primary/20 hover:shadow-lg transition-all duration-300 cursor-pointer animate-fade-in group"
      style={{ animationDelay: `${index * 30}ms` }}
      onClick={() => onView(product.id)}
    >
      <div className="relative aspect-square overflow-hidden">
        <OptimizedImage
          src={product.image}
          alt={product.name}
          className="w-full h-full group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {hasDiscount && (
            <span className="bg-destructive text-destructive-foreground px-2 py-0.5 rounded-lg shadow text-[10px] font-bold">
              {product.discountType === 'percentage' ? `${product.discountValue}%-` : `${product.discountValue?.toLocaleString()}-`}
            </span>
          )}
          {isNew && (
            <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-lg shadow text-[10px] font-bold flex items-center gap-0.5">
              <Sparkles className="w-3 h-3" /> جديد
            </span>
          )}
          {isLowStock && (
            <span className="bg-warning text-warning-foreground px-2 py-0.5 rounded-lg shadow text-[10px] font-bold flex items-center gap-0.5">
              <Flame className="w-3 h-3" /> آخر {product.stockQuantity}
            </span>
          )}
          {isOutOfStock && (
            <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-lg shadow text-[10px] font-bold">
              نفذ المخزون
            </span>
          )}
        </div>

        {/* Favorite & Share */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          <button
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              isFavorite ? 'bg-destructive text-destructive-foreground scale-110' : 'bg-card/80 text-muted-foreground hover:text-destructive'
            }`}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(product.id); }}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          <button
            className="w-7 h-7 rounded-full bg-card/80 text-muted-foreground hover:text-primary flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
            onClick={handleShare}
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Social proof */}
        {viewerCount >= 3 && (
          <div className="absolute bottom-2 left-2 bg-card/90 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
            <Eye className="w-3 h-3 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground">{viewerCount} يشاهدون</span>
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-semibold text-sm mb-1 text-right line-clamp-1 text-foreground">{product.name}</h3>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-0.5">
            <Star className="w-3 h-3 text-amber-400 fill-current" />
            <span className="text-[10px] text-muted-foreground">{product.rating?.toFixed(1) || '4.5'}</span>
          </div>
          <div className="text-right">
            {hasDiscount && product.originalPrice ? (
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-muted-foreground line-through">{product.originalPrice.toLocaleString()}</span>
                <span className="text-sm font-bold text-destructive">{product.price.toLocaleString()} د.ع</span>
              </div>
            ) : (
              <span className="text-sm font-bold text-foreground">{product.price.toLocaleString()} د.ع</span>
            )}
          </div>
        </div>

        {/* Add to cart / quantity control */}
        {cartQuantity > 0 ? (
          <div className="flex items-center justify-between bg-primary/10 rounded-xl h-8 px-2">
            <button onClick={(e) => { e.stopPropagation(); onUpdateQuantity(product.id, cartQuantity + 1); }} className="p-1 text-primary hover:bg-primary/20 rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-bold text-primary">{cartQuantity}</span>
            <button onClick={(e) => { e.stopPropagation(); onUpdateQuantity(product.id, cartQuantity - 1); }} className="p-1 text-primary hover:bg-primary/20 rounded-lg transition-colors">
              <Minus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <Button
            size="sm"
            className="w-full h-8 text-xs rounded-xl border-0 bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-sm"
            onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
            disabled={isOutOfStock}
          >
            {isOutOfStock ? (
              <>نفذ المخزون</>
            ) : (
              <><Plus className="w-3 h-3 ml-1" /> أضف للسلة</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
