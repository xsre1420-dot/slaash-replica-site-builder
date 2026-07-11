import { Check, ShoppingBag, Star, Zap } from 'lucide-react';

import { Link } from 'react-router-dom';

import type { Product } from '@/types';

import ProductPriceDisplay from '@/components/storefront/ProductPriceDisplay';

import ProductQuantity from '@/components/product-details/ProductQuantity';

import {
  getProductHighlight,
  getProductOptionSummary,
  getDiscountBadgeLabel,
  getVariantOptionQty,
  hasPromotionalPricing,
} from '@/lib/storefrontProductDisplay';

import { getStoreHomePath } from '@/lib/storefrontPaths';

import { cn } from '@/lib/utils';



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

    className="inline-flex items-center gap-2 text-sm hover:opacity-80 transition-opacity group"

    disabled={!onReviewsClick}

  >

    <div className="flex items-center gap-0.5" aria-label={`${rating} من 5`}>

      {Array.from({ length: 5 }).map((_, i) => (

        <Star

          key={i}

          className={cn(

            'w-4 h-4 transition-colors',

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

      <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors underline-offset-2 group-hover:underline">

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

  returnPolicy,

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

  const highlight = getProductHighlight(product);

  const discountLabel = hasPromotionalPricing(displayProduct) ? getDiscountBadgeLabel(displayProduct) : null;

  const storeHome = getStoreHomePath(isTenantMode ? storeSlug : null);

  const selectedColorOption = product.colors?.find((c) => c.value === selectedColor);
  const selectedColorName = selectedColorOption?.name?.trim() || null;

  const sizeInStock = (size: string) =>
    getVariantOptionQty(displayProduct, { size, color: selectedColor || undefined }) > 0;

  const colorInStock = (colorValue: string) =>
    getVariantOptionQty(displayProduct, { color: colorValue }) > 0;

  const optionSummary = getProductOptionSummary(product);



  return (

    <div className={cn('space-y-6', className)}>

      {/* Breadcrumb — subtle, above title */}

      <nav

        className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground"

        aria-label="مسار التصفح"

      >

        <div className="flex flex-wrap items-center gap-1 min-w-0">

          <Link to={storeHome} className="hover:text-primary transition-colors shrink-0">

            المتجر

          </Link>

          {product.category && (

            <>

              <span aria-hidden className="opacity-40">/</span>

              <span className="truncate">{product.category}</span>

            </>

          )}

        </div>

        {product.sku && (

          <span className="font-mono shrink-0 tabular-nums opacity-70" dir="ltr">

            {product.sku}

          </span>

        )}

      </nav>



      {/* 1. Product Name */}

      <div className="space-y-3">

        <div className="flex flex-wrap items-center justify-end gap-2">

          {isNew && (

            <span className="text-[10px] font-semibold text-primary-foreground bg-primary px-2.5 py-0.5 rounded-full">

              جديد

            </span>

          )}

        </div>

        <h1 className="text-2xl sm:text-[1.75rem] lg:text-[2rem] font-bold text-foreground leading-tight text-right tracking-tight">

          {product.name}

        </h1>



        {/* 2. Rating */}

        {product.rating != null && product.rating > 0 && (

          <div className="flex justify-end">

            <StarRating

              rating={product.rating}

              count={product.reviewCount}

              onReviewsClick={scrollToReviews}

            />

          </div>

        )}



        {/* 3. Price + 4. Discount */}

        <div className="space-y-2 pt-1">

          <ProductPriceDisplay product={displayProduct} size="lg" align="end" />

          {discountLabel && (

            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-xs font-bold px-3 py-1">

              {discountLabel} خصم

            </span>

          )}

        </div>



        {/* 5. Availability */}

        <div

          className={cn(

            'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium',

            isOutOfStock

              ? 'bg-muted/60 text-muted-foreground'

              : isLowStock

                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'

                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'

          )}

        >

          <span

            className={cn(

              'w-1.5 h-1.5 rounded-full shrink-0',

              isOutOfStock ? 'bg-muted-foreground' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'

            )}

          />

          {isOutOfStock

            ? 'غير متوفر حالياً'

            : isLowStock

              ? `متبقي ${variantAvailable} فقط`

              : `متوفر — ${variantAvailable} قطعة`}

        </div>

        {optionSummary && (
          <p className="text-xs text-muted-foreground text-right">{optionSummary} متاح للاختيار</p>
        )}

        {/* 6. Short blurb only — full description lives in ProductDescriptionBlock below */}
        {highlight && (
          <p className="text-sm text-muted-foreground leading-relaxed text-right line-clamp-3 border-r-2 border-primary/30 pr-3">
            {highlight}
          </p>
        )}

      </div>



      {/* 7. Color selector — image + name (no hex codes) */}
      {product.colors && product.colors.length > 0 && (
        <div className="space-y-3 pt-1 border-t border-border/10">
          <p className="text-sm font-medium text-foreground text-right">
            اللون <span className="text-destructive">*</span>
            {selectedColorName && (
              <span className="text-muted-foreground font-normal mr-1.5">· {selectedColorName}</span>
            )}
          </p>

          <div className="flex flex-wrap gap-3 justify-end">
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
                  className={cn(
                    'flex flex-col items-center gap-1.5 w-[4.5rem] sm:w-20 transition-opacity',
                    !available && 'opacity-40 cursor-not-allowed'
                  )}
                  aria-label={label || 'لون'}
                  aria-pressed={selected}
                  title={available ? label || 'لون' : `${label || 'لون'} — غير متوفر`}
                >
                  <div
                    className={cn(
                      'relative w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all duration-200',
                      selected
                        ? 'border-primary scale-105 shadow-md shadow-primary/15'
                        : 'border-border/40 hover:border-primary/40 hover:scale-[1.02]'
                    )}
                  >
                    {color.image ? (
                      <img
                        src={color.image}
                        alt={label || ''}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted/50 flex items-center justify-center">
                        <span
                          className="w-8 h-8 rounded-full border-2 border-background shadow-sm"
                          style={{ backgroundColor: color.value.startsWith('#') ? color.value : '#d4d4d4' }}
                        />
                      </div>
                    )}

                    {selected && (
                      <span className="absolute inset-0 flex items-center justify-center bg-primary/15">
                        <Check className="w-5 h-5 text-primary drop-shadow-sm" strokeWidth={2.5} />
                      </span>
                    )}

                    {!available && (
                      <span className="absolute inset-0 flex items-center justify-center pointer-events-none bg-background/40">
                        <span className="w-[120%] h-px bg-foreground/50 rotate-45 absolute" />
                      </span>
                    )}
                  </div>

                  {label && (
                    <span
                      className={cn(
                        'text-[11px] max-w-full truncate text-center',
                        selected ? 'text-primary font-semibold' : 'text-muted-foreground'
                      )}
                    >
                      {label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}



      {/* 8. Size selector */}
      {product.sizes && product.sizes.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground text-right">
            القياس <span className="text-destructive">*</span>
            {selectedSize && (
              <span className="text-muted-foreground font-normal mr-1.5">· {selectedSize}</span>
            )}
          </p>

          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">

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

                    'relative min-h-[44px] rounded-xl text-sm font-semibold transition-all duration-200 border',

                    selected

                      ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20'

                      : available

                        ? 'bg-background text-foreground border-border/30 hover:border-primary/50 hover:text-primary hover:bg-primary/5'

                        : 'bg-background text-muted-foreground border-border/30 cursor-not-allowed opacity-50'

                  )}

                  title={available ? `${qty} متاح` : 'غير متوفر'}

                >

                  <span className={cn(!available && 'line-through decoration-foreground/40')}>{size}</span>

                </button>

              );

            })}

          </div>

        </div>

      )}



      {/* 9. Quantity */}

      <div className="flex items-center justify-between gap-3 py-1">

        <span className="text-sm font-medium text-foreground">الكمية</span>

        <ProductQuantity

          quantity={quantity}

          onIncrement={onIncrementQty}

          onDecrement={onDecrementQty}

        />

      </div>



      {/* 10. Add to Cart + Buy Now */}
      <div className="flex flex-col gap-2.5 pt-1">
        <div className="flex gap-2.5 sm:flex-col sm:gap-2.5">
          <button
            type="button"
            onClick={onAddToCart}
            disabled={isAdding || isOutOfStock}
            className="flex-1 sm:w-full h-12 sm:min-h-[52px] inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-bold text-sm sm:text-base hover:bg-primary/90 disabled:opacity-50 transition-all duration-200 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 active:scale-[0.99]"
          >
            <ShoppingBag className="w-5 h-5" />
            {isAdding ? 'جاري الإضافة…' : isOutOfStock ? 'غير متوفر' : 'أضف للسلة'}
          </button>
          <button
            type="button"
            onClick={onBuyNow}
            disabled={isAdding || isOutOfStock}
            className="flex-1 sm:w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary/25 text-primary font-semibold hover:bg-primary/5 disabled:opacity-50 transition-all duration-200"
          >
            <Zap className="w-4 h-4" />
            اشتري الآن
          </button>
        </div>
      </div>
    </div>
  );
};



export default ProductInfoPanel;

