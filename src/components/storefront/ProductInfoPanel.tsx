import { useState, useCallback } from 'react';
import { Check, ShoppingBag, Star, Zap, Heart, Share2, Loader2 } from 'lucide-react';
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
    className="inline-flex items-center gap-2 text-sm hover:opacity-80 transition-opacity duration-150 group disabled:cursor-default"
  >
    <div className="flex items-center gap-0.5" aria-label={`${rating} من 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'w-3.5 h-3.5',
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
    <div dir="rtl" className={cn('sf-pdp-panel', className)}>
      <nav
        className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground/80 sf-enter"
        aria-label="مسار التصفح"
        style={{ ['--sf-stagger' as string]: 0 }}
      >
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <Link to={storeHome} className="hover:text-primary transition-colors duration-150">
            المتجر
          </Link>
          {product.category && (
            <>
              <span aria-hidden className="opacity-25">/</span>
              <span className="truncate">{product.category}</span>
            </>
          )}
        </div>
        {product.sku && (
          <span className="font-mono shrink-0 tabular-nums opacity-50 text-[10px]" dir="ltr">
            {product.sku}
          </span>
        )}
      </nav>

      <div className="space-y-3 sf-enter" style={{ ['--sf-stagger' as string]: 1 }}>
        {(isNew || product.brand?.trim()) && (
          <div className="flex flex-wrap items-center gap-2">
            {isNew && (
              <span className="sf-badge bg-primary text-primary-foreground">جديد</span>
            )}
            {product.brand?.trim() && (
              <span className="sf-badge bg-muted/80 text-muted-foreground font-medium">
                {product.brand.trim()}
              </span>
            )}
          </div>
        )}

        <h1 className="text-xl sm:text-2xl lg:text-[1.75rem] font-bold text-foreground leading-snug tracking-tight">
          {product.name}
        </h1>

        {product.rating != null && product.rating > 0 && (
          <StarRating
            rating={product.rating}
            count={product.reviewCount}
            onReviewsClick={scrollToReviews}
          />
        )}
      </div>

      <div className="sf-pdp-price-block sf-enter" style={{ ['--sf-stagger' as string]: 2 }}>
        <ProductPriceDisplay product={displayProduct} size="lg" align="right" />
        {discountLabel && (
          <p className="text-xs sm:text-sm text-primary/90 font-medium">
            وفّر {discountLabel.replace(/^-/, '')} على هذا المنتج
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 sf-enter" style={{ ['--sf-stagger' as string]: 3 }}>
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium',
            isOutOfStock
              ? 'bg-muted text-muted-foreground'
              : isLowStock
                ? 'bg-warning/10 text-warning'
                : 'bg-success/10 text-success'
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              isOutOfStock ? 'bg-muted-foreground' : isLowStock ? 'bg-warning' : 'bg-success'
            )}
          />
          {isOutOfStock
            ? 'غير متوفر حالياً'
            : isLowStock
              ? `متبقي ${variantAvailable} فقط`
              : `متوفر (${variantAvailable} قطعة)`}
        </span>
        {optionSummary && (
          <span className="text-xs text-muted-foreground">{optionSummary} متاح</span>
        )}
      </div>

      {highlight && (
        <p className="sf-pdp-hint sf-enter" style={{ ['--sf-stagger' as string]: 4 }}>
          {highlight}
        </p>
      )}

      {product.colors && product.colors.length > 0 && (
        <div className="sf-pdp-divider space-y-3 sf-enter" style={{ ['--sf-stagger' as string]: 5 }}>
          <p className="sf-pdp-label">
            اللون <span className="text-destructive">*</span>
            {selectedColorName && (
              <span className="text-muted-foreground font-normal mr-2">· {selectedColorName}</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2.5">
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
                  className={cn('group flex flex-col items-center gap-1.5 transition-opacity', !available && 'opacity-40')}
                  aria-pressed={selected}
                >
                  <div
                    className={cn(
                      'sf-pdp-color-swatch',
                      selected ? 'sf-pdp-color-swatch-selected' : 'sf-pdp-color-swatch-default'
                    )}
                  >
                    {color.image ? (
                      <img
                        src={resolveMediaDeliveryUrl(color.image, { variant: 'thumbnail' })}
                        alt={label || ''}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        width={64}
                        height={64}
                        onError={(e) => {
                          if (color.image && e.currentTarget.src !== color.image) {
                            e.currentTarget.src = color.image;
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-muted/40 flex items-center justify-center">
                        <span
                          className="w-7 h-7 rounded-full border-2 border-background shadow-sm"
                          style={{ backgroundColor: color.value.startsWith('#') ? color.value : '#d4d4d4' }}
                        />
                      </div>
                    )}
                    {selected && (
                      <span className="absolute inset-0 flex items-center justify-center bg-primary/10">
                        <Check className="w-4 h-4 text-primary" strokeWidth={2.5} />
                      </span>
                    )}
                    {!available && (
                      <span className="absolute inset-0 bg-background/50 flex items-center justify-center">
                        <span className="w-full h-px bg-foreground/40 rotate-45 absolute" />
                      </span>
                    )}
                  </div>
                  {label && (
                    <span className={cn('text-[10px] max-w-[4rem] truncate', selected ? 'text-primary font-semibold' : 'text-muted-foreground')}>
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
        <div className={cn('space-y-3 sf-enter', product.colors?.length ? '' : 'sf-pdp-divider')} style={{ ['--sf-stagger' as string]: 6 }}>
          <p className="sf-pdp-label">
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
                    'sf-pdp-option',
                    selected
                      ? 'sf-pdp-option-selected'
                      : available
                        ? 'sf-pdp-option-default'
                        : 'sf-pdp-option-disabled'
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

      <div className="flex items-center justify-between gap-4 sf-pdp-divider sf-enter" style={{ ['--sf-stagger' as string]: 7 }}>
        <span className="sf-pdp-label">الكمية</span>
        <ProductQuantity
          quantity={quantity}
          onIncrement={onIncrementQty}
          onDecrement={onDecrementQty}
          max={variantAvailable > 0 ? variantAvailable : undefined}
        />
      </div>

      <div className="space-y-2.5 sf-enter" style={{ ['--sf-stagger' as string]: 8 }}>
        <button
          type="button"
          onClick={onAddToCart}
          disabled={isAdding || isOutOfStock}
          className="w-full sf-btn-primary h-12 sm:h-[3.25rem] text-base disabled:opacity-50"
        >
          {isAdding ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <ShoppingBag className="w-5 h-5" />
          )}
          {isAdding ? 'جاري الإضافة…' : isOutOfStock ? 'غير متوفر' : 'أضف إلى السلة'}
        </button>
        <button
          type="button"
          onClick={onBuyNow}
          disabled={isAdding || isOutOfStock}
          className="w-full sf-btn-secondary h-12 sm:h-[3.25rem] text-base disabled:opacity-50"
        >
          <Zap className="w-5 h-5" />
          اشتري الآن
        </button>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setWishlisted((v) => !v)}
            className={cn(
              'flex-1 sf-btn-secondary h-10 text-sm',
              wishlisted && 'border-primary/40 text-primary bg-primary/5'
            )}
            aria-pressed={wishlisted}
          >
            <Heart className={cn('w-4 h-4', wishlisted && 'fill-primary')} />
            {wishlisted ? 'في المفضلة' : 'المفضلة'}
          </button>
          <button type="button" onClick={() => void handleShare()} className="flex-1 sf-btn-secondary h-10 text-sm">
            <Share2 className="w-4 h-4" />
            مشاركة
          </button>
        </div>
      </div>

      <ProductTrustStrip className="sf-enter" style={{ ['--sf-stagger' as string]: 9 }} />
    </div>
  );
};

export default ProductInfoPanel;
