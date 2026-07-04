import { Check, Heart, Package, ShoppingBag, Star, Truck, Zap } from 'lucide-react';

import { Link } from 'react-router-dom';

import type { Product } from '@/types';

import ProductPriceDisplay from '@/components/storefront/ProductPriceDisplay';

import ProductQuantity from '@/components/product-details/ProductQuantity';

import {

  getDiscountBadgeLabel,

  getProductHighlight,

  getVariantOptionQty,

  hasPromotionalPricing,

} from '@/lib/storefrontProductDisplay';

import { getStoreHomePath } from '@/lib/storefrontPaths';

import { useFavorites } from '@/hooks/useFavorites';

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
  const fullDescription = product.description?.trim() ?? '';
  const detailBelowHighlight =
    fullDescription && (!highlight || fullDescription !== highlight) ? fullDescription : '';

  const discountLabel = hasPromotionalPricing(displayProduct) ? getDiscountBadgeLabel(displayProduct) : null;

  const storeHome = getStoreHomePath(isTenantMode ? storeSlug : null);

  const { isFavorite, toggleFavorite } = useFavorites(storeSlug);



  const selectedColorName =

    product.colors?.find((c) => c.value === selectedColor)?.name || selectedColor;



  const sizeInStock = (size: string) =>

    getVariantOptionQty(displayProduct, { size, color: selectedColor || undefined }) > 0;



  const colorInStock = (colorValue: string) =>

    getVariantOptionQty(displayProduct, { color: colorValue }) > 0;



  const favorited = isFavorite(product.id);



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



        {/* 6. Short blurb + full description */}

        {(highlight || detailBelowHighlight) && (
          <div className="space-y-2">
            {highlight && (
              <p className="text-sm text-muted-foreground leading-relaxed text-right line-clamp-3 border-r-2 border-primary/30 pr-3">
                {highlight}
              </p>
            )}
            {detailBelowHighlight && (
              <p className="text-sm text-muted-foreground leading-relaxed text-right whitespace-pre-wrap border-r-2 border-border/30 pr-3">
                {detailBelowHighlight}
              </p>
            )}
          </div>
        )}

      </div>



      {/* 7. Color selector */}

      {product.colors && product.colors.length > 0 && (

        <div className="space-y-3 pt-1 border-t border-border/10">

          <div className="flex items-center justify-between gap-2">

            <p className="text-sm font-medium text-foreground text-right">

              اللون

              {selectedColorName && (

                <span className="text-muted-foreground font-normal mr-1.5">· {selectedColorName}</span>

              )}

            </p>

          </div>

          <div className="flex flex-wrap gap-2.5 justify-end">

            {product.colors.map((color, index) => {

              const available = colorInStock(color.value);

              const selected = selectedColor === color.value;

              return (

                <button

                  key={`${color.value}-${index}`}

                  type="button"

                  disabled={!available}

                  onClick={() => onSelectColor(selected ? '' : color.value)}

                  className={cn(

                    'relative w-12 h-12 rounded-xl overflow-hidden transition-all duration-200 border-2',

                    selected

                      ? 'border-primary scale-105 shadow-md shadow-primary/15'

                      : 'border-transparent hover:border-primary/40 hover:scale-[1.03]',

                    !available && 'opacity-35 cursor-not-allowed grayscale'

                  )}

                  aria-label={color.name || 'لون'}

                  aria-pressed={selected}

                  title={available ? color.name || color.value : `${color.name || 'لون'} — غير متوفر`}

                >

                  {color.image ? (

                    <img src={color.image} alt="" className="w-full h-full object-cover" />

                  ) : (

                    <span className="block w-full h-full" style={{ backgroundColor: color.value }} />

                  )}

                  {selected && (

                    <span className="absolute inset-0 flex items-center justify-center bg-primary/15">

                      <Check className="w-4 h-4 text-primary drop-shadow-sm" strokeWidth={2.5} />

                    </span>

                  )}

                  {!available && (

                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none">

                      <span className="w-[120%] h-px bg-foreground/50 rotate-45 absolute" />

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

            المقاس

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



      {/* 10. Add to Cart + Buy Now — desktop */}

      <div className="hidden sm:flex flex-col gap-2.5">

        <button

          type="button"

          onClick={onAddToCart}

          disabled={isAdding || isOutOfStock}

          className="w-full h-13 min-h-[52px] inline-flex items-center justify-center gap-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 disabled:opacity-50 transition-all duration-200 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 active:scale-[0.99]"

        >

          <ShoppingBag className="w-5 h-5" />

          {isAdding ? 'جاري الإضافة…' : isOutOfStock ? 'غير متوفر' : 'أضف للسلة'}

        </button>

        <button

          type="button"

          onClick={onBuyNow}

          disabled={isAdding || isOutOfStock}

          className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary/25 text-primary font-semibold hover:bg-primary/5 disabled:opacity-50 transition-all duration-200"

        >

          <Zap className="w-4 h-4" />

          اشتري الآن

        </button>

      </div>



      {/* 11. Wishlist */}

      <button

        type="button"

        onClick={() => toggleFavorite(product.id)}

        aria-label={favorited ? 'إزالة من المفضلة' : 'أضف للمفضلة'}

        aria-pressed={favorited}

        className={cn(

          'hidden sm:flex w-full h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-200 border',

          favorited

            ? 'bg-destructive/8 text-destructive border-destructive/20 hover:bg-destructive/12'

            : 'bg-background text-muted-foreground border-border/20 hover:text-primary hover:border-primary/30 hover:bg-primary/5'

        )}

      >

        <Heart className={cn('w-4 h-4', favorited && 'fill-current')} />

        {favorited ? 'في قائمة المفضلة' : 'أضف للمفضلة'}

      </button>



      {/* 12. Shipping & trust */}

      <div className="rounded-xl px-4 py-3.5 space-y-2.5 border border-border/10">

        <p className="text-xs font-semibold text-foreground text-right">الشحن والتوصيل</p>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">

          <span className="inline-flex items-center gap-1.5">

            <Truck className="w-3.5 h-3.5 shrink-0 text-primary" />

            توصيل سريع

          </span>

          <span className="inline-flex items-center gap-1.5">

            <Package className="w-3.5 h-3.5 shrink-0 text-primary" />

            {returnPolicy ? 'إرجاع متاح' : 'جودة مضمونة'}

          </span>

          {isTenantMode && (

            <span className="inline-flex items-center gap-1.5 text-primary/80 font-medium">

              الدفع عند الاستلام

            </span>

          )}

        </div>

      </div>

    </div>

  );

};



export default ProductInfoPanel;

