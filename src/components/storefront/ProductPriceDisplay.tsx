import { cn } from '@/lib/utils';
import type { Product } from '@/types';
import {
  formatStorePrice,
  getDiscountBadgeLabel,
  getProductListPrice,
  getProductSalePrice,
  hasPromotionalPricing,
} from '@/lib/storefrontProductDisplay';

interface ProductPriceDisplayProps {
  product: Product;
  size?: 'sm' | 'md' | 'lg';
  /** Visual alignment in RTL storefront — `right` is the default for Arabic. */
  align?: 'right' | 'left';
  showBadge?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: {
    list: 'text-[11px] leading-none',
    sale: 'text-sm font-bold leading-tight',
    badge: 'text-[10px] px-1.5 py-0.5',
  },
  md: {
    list: 'text-xs leading-none',
    sale: 'text-base font-bold leading-tight',
    badge: 'text-[10px] px-2 py-0.5',
  },
  lg: {
    list: 'text-sm leading-none',
    sale: 'text-3xl sm:text-4xl font-bold leading-none',
    badge: 'text-xs px-2.5 py-1',
  },
} as const;

const ProductPriceDisplay = ({
  product,
  size = 'md',
  align = 'right',
  showBadge = true,
  className,
}: ProductPriceDisplayProps) => {
  const sale = getProductSalePrice(product);
  const list = getProductListPrice(product);
  const onSale = hasPromotionalPricing(product);
  const badge = showBadge ? getDiscountBadgeLabel(product) : null;
  const s = sizeClasses[size];

  const isRight = align === 'right';

  return (
    <div
      dir="rtl"
      className={cn(
        'inline-flex flex-col gap-1 min-w-0',
        isRight ? 'items-start text-right' : 'items-end text-left',
        className
      )}
    >
      {onSale && list != null && (
        <span className={cn('text-muted-foreground/75 line-through tabular-nums font-medium', s.list)}>
          {formatStorePrice(list)}
        </span>
      )}

      <div
        className={cn(
          'flex items-baseline gap-1.5 flex-wrap',
          isRight ? 'justify-start' : 'justify-end'
        )}
      >
        <span
          className={cn(
            'tabular-nums tracking-tight',
            onSale ? 'text-destructive' : 'text-foreground',
            s.sale
          )}
        >
          {formatStorePrice(sale)}
        </span>

        {badge && showBadge && size !== 'lg' && (
          <span
            className={cn(
              'sf-badge bg-destructive/10 text-destructive font-semibold shrink-0',
              s.badge
            )}
          >
            -{badge.replace(/^-/, '')}
          </span>
        )}
      </div>
    </div>
  );
};

export default ProductPriceDisplay;
