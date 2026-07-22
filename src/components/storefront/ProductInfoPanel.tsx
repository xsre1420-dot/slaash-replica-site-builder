import { useState, useCallback } from 'react';
import { Check, ShoppingBag, Star, Zap, Heart, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { Product } from '@/types';
import ProductPriceDisplay from '@/components/storefront/ProductPriceDisplay';
import ProductQuantity from '@/components/product-details/ProductQuantity';
import ProductTrustStrip from '@/components/product-details/ProductTrustStrip';
import {
  getProductHighlight,
  getProductOptionSummary,
  getDiscountBadgeLabel,
  getVariantOptionQty,
  hasPromotionalPricing,
} from '@/lib/storefrontProductDisplay';
import { getStoreHomePath } from '@/lib/storefrontPaths';
import { cn } from '@/lib/utils';
import { resolveMediaDeliveryUrl } from '@/utils/cdnMediaUtils';

interface ProductInfoPanelProps {
  product: Product;
  displayProduct: Product;
  variantAvailable: number;
  isOutOfStock: boolean;
  isLowStock: boolean;
  isNew: boolean;
  selectedSize: string;
  selectedColor: string;
  quantity: number;
  isAdding: boolean;
  returnPolicy?: string;
  isTenantMode?: boolean;
  storeSlug?: string;
  onSelectSize: (size: string) => void;
  onSelectColor: (color: string) => void;
  onIncrementQty: () => void;
  onDecrementQty: () => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
  className?: string;
}

const StarRating = ({
  rating,
  count,
  onReviewsClick,
}: {
  rating: number;
  count?: number;
  onReviewsClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onReviewsClick}
    disabled={!onReviewsClick}
    className="inline-flex items-center gap-2 text-sm hover:opacity-80 transition-opacity group disabled:cursor-default"
  >
    <div className="flex items-center gap-0.5" aria-label={`${rating} من 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'w-4 h-4',
            i < Math.floor(rating)
              ? 'fill-amber-400 text-amber-400'
              : i < rating
                ? 'fill-amber-400/50 text-amber-400'
                : 'fill-muted text-muted-foreground/20'
          )}
        />
      ))}
    </div>
    {count != null && count > 0 && (
      <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
        ({count} {count === 1 ? 'مراجعة' : 'مراجعات'})
      </span>
    )}
  </button>
);

const scrollToReviews = () => {
  document.getElementById('product-reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const ProductInfoPanel = ({
  product,
  displayProduct,
  variantAvailable,
  isOutOfStock,
  isLowStock,
  isNew,
  selectedSize,
  selectedColor,
  quantity,
  isAdding,
  isTenantMode,
  storeSlug,
  onSelectSize,
  onSelectColor,
  onIncrementQty,
  onDecrementQty,
  onAddToCart,
  onBuyNow,
  className,
}: ProductInfoPanelProps) => {
  const [wishlisted, setWishlisted] = useState(false);
  const highlight = getProductHighlight(product);
  const discountLabel = hasPromotionalPricing(displayProduct) ? getDiscountBadgeLabel(displayProduct) : null;
  const storeHome = getStoreHomePath(isTenantMode ? storeSlug : null);
  const selectedColorOption = product.colors?.find((c) => c.value === selectedColor);
  const selectedColorName = selectedColorOption?.name?.trim() || null;
  const optionSummary = getProductOptionSummary(product);

  const sizeInStock = (size: string) =>
    getVariantOptionQty(displayProduct, { size, color: selectedColor || undefined }) > 0;

  const colorInStock = (colorValue: string) =>
    getVariantOptionQty(displayProduct, { color: colorValue }) > 0;

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('تم نسخ رابط المنتج');
      }
    } catch {
      /* user cancelled */
    }
  }, [product.name]);

  return (
    <div dir="rtl" className={cn('space-y-8', className)}>
      <nav
        className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
        aria-label="مسار التصفح"
      >
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <Link to={storeHome} className="hover:text-primary transition-colors">
            المتجر
          </Link>
          {product.category && (
            <>
              <span aria-hidden className="opacity-30">/</span>
              <span className="truncate">{product.category}</span>
            </>
          )}
        </div>
        {product.sku && (
          <span className="font-mono shrink-0 tabular-nums opacity-60 text-[11px]" dir="ltr">
            {product.sku}
          </span>
        )}
      </nav>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {isNew && (
            <span className="sf-badge bg-primary text-primary-foreground">جديد</span>
          )}
          {product.brand?.trim() && (
            <span className="sf-badge bg-muted text-muted-foreground font-medium">
              {product.brand.trim()}
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-[2rem] font-bold text-foreground leading-[1.15] tracking-tight">
          {product.name}
        </h1>

        {product.rating != null && product.rating > 0 && (
          <StarRating
            rating={product.rating}
            count={product.reviewCount}
            onReviewsClick={scrollToReviews}
          />
        )}

        <div className="rounded-xl border border-border/40 bg-muted/20 p-4 sm:p-5 space-y-2">
          <ProductPriceDisplay product={displayProduct} size="lg" align="right" />
          {discountLabel && (
            <p className="text-sm text-primary font-medium">وفّر {discountLabel.replace(/^-/, '')} على هذا المنتج</p>
          )}
        </div>

        <div
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium',
            isOutOfStock
              ? 'bg-muted text-muted-foreground'
              : isLowStock
                ? 'bg-warning/10 text-warning'
                : 'bg-success/10 text-success'
          )}
        >
          <span
            className={cn(
              'w-2 h-2 rounded-full shrink-0',
              isOutOfStock ? 'bg-muted-foreground' : isLowStock ? 'bg-warning' : 'bg-success'
            )}
          />
          {isOutOfStock
            ? 'غير متوفر حالياً'
            : isLowStock
              ? `متبقي ${variantAvailable} فقط — اطلب الآن`
              : `متوفر (${variantAvailable} قطعة)`}
        </div>

        {optionSummary && (
          <p className="text-sm text-muted-foreground">{optionSummary} متاح للاختيار</p>
        )}

        {highlight && (
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed border-r-2 border-primary/25 pr-4">
            {highlight}
          </p>
        )}
      </div>

      {product.colors && product.colors.length > 0 && (
        <div className="space-y-4 pt-2 border-t border-border/30">
          <p className="text-sm font-semibold text-foreground">
            اللون <span className="text-destructive">*</span>
            {selectedColorName && (
              <span className="text-muted-foreground font-normal mr-2">· {selectedColorName}</span>
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            {product.colors.map((color, index) => {
              const available = colorInStock(color.value);
              const selected = selectedColor === color.value;
              const label = color.name?.trim();
              return (
                <button
                  key={`${color.value}-${index}`}
                  type="button"
                  disabled={!available}
                  onClick={() => onSelectColor(selected ? '' : color.value)}
                  className={cn('group flex flex-col items-center gap-2 transition-opacity', !available && 'opacity-40')}
                  aria-pressed={selected}
                >
                  <div
                    className={cn(
                      'relative w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-2xl overflow-hidden border-2 transition-all duration-200',
                      selected
                        ? 'border-primary ring-2 ring-primary/20 scale-105'
                        : 'border-border/50 hover:border-primary/40 group-hover:scale-[1.02]'
                    )}
                  >
                    {color.image ? (
                      <img
                        src={resolveMediaDeliveryUrl(color.image, { variant: 'thumbnail' })}
                        alt={label || ''}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        width={72}
                        height={72}
                        onError={(e) => {
                          if (color.image && e.currentTarget.src !== color.image) {
                            e.currentTarget.src = color.image;
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-muted/40 flex items-center justify-center">
                        <span
                          className="w-8 h-8 rounded-full border-2 border-background shadow-sm"
                          style={{ backgroundColor: color.value.startsWith('#') ? color.value : '#d4d4d4' }}
                        />
                      </div>
                    )}
                    {selected && (
                      <span className="absolute inset-0 flex items-center justify-center bg-primary/10">
                        <Check className="w-5 h-5 text-primary" strokeWidth={2.5} />
                      </span>
                    )}
                    {!available && (
                      <span className="absolute inset-0 bg-background/50 flex items-center justify-center">
                        <span className="w-full h-px bg-foreground/40 rotate-45 absolute" />
                      </span>
                    )}
                  </div>
                  {label && (
                    <span className={cn('text-[11px] max-w-[4.5rem] truncate', selected ? 'text-primary font-semibold' : 'text-muted-foreground')}>
                      {label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {product.sizes && product.sizes.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground">
            المقاس <span className="text-destructive">*</span>
            {selectedSize && <span className="text-muted-foreground font-normal mr-2">· {selectedSize}</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((size) => {
              const qty = getVariantOptionQty(displayProduct, { size, color: selectedColor || undefined });
              const available = qty > 0;
              const selected = selectedSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  disabled={!available}
                  onClick={() => onSelectSize(selected ? '' : size)}
                  aria-pressed={selected}
                  className={cn(
                    'min-h-[44px] min-w-[3rem] px-4 rounded-xl text-sm font-semibold border transition-all duration-200',
                    selected
                      ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/15'
                      : available
                        ? 'bg-card border-border/50 hover:border-primary/40 hover:text-primary'
                        : 'opacity-45 cursor-not-allowed line-through decoration-muted-foreground'
                  )}
                  title={available ? `${qty} متاح` : 'غير متوفر'}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 py-1">
        <span className="text-sm font-semibold text-foreground">الكمية</span>
        <ProductQuantity
          quantity={quantity}
          onIncrement={onIncrementQty}
          onDecrement={onDecrementQty}
          max={variantAvailable > 0 ? variantAvailable : undefined}
        />
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={onAddToCart}
          disabled={isAdding || isOutOfStock}
          className="w-full sf-btn-primary h-14 text-base disabled:opacity-50"
        >
          <ShoppingBag className="w-5 h-5" />
          {isAdding ? 'جاري الإضافة…' : isOutOfStock ? 'غير متوفر' : 'أضف إلى السلة'}
        </button>
        <button
          type="button"
          onClick={onBuyNow}
          disabled={isAdding || isOutOfStock}
          className="w-full sf-btn-secondary h-14 text-base disabled:opacity-50"
        >
          <Zap className="w-5 h-5" />
          اشتري الآن
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setWishlisted((v) => !v)}
            className={cn(
              'flex-1 sf-btn-secondary h-11 text-sm',
              wishlisted && 'border-primary/40 text-primary bg-primary/5'
            )}
            aria-pressed={wishlisted}
          >
            <Heart className={cn('w-4 h-4', wishlisted && 'fill-primary')} />
            {wishlisted ? 'في المفضلة' : 'المفضلة'}
          </button>
          <button type="button" onClick={() => void handleShare()} className="flex-1 sf-btn-secondary h-11 text-sm">
            <Share2 className="w-4 h-4" />
            مشاركة
          </button>
        </div>
      </div>

      <ProductTrustStrip />
    </div>
  );
};

export default ProductInfoPanel;
