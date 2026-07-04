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
  align?: 'start' | 'end';
  showBadge?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: { list: 'text-[10px]', sale: 'text-sm', badge: 'text-[9px] px-2 py-0.5' },
  md: { list: 'text-xs', sale: 'text-lg', badge: 'text-[10px] px-2.5 py-0.5' },
  lg: { list: 'text-sm', sale: 'text-3xl sm:text-[2rem]', badge: 'text-xs px-2.5 py-1' },
} as const;

const ProductPriceDisplay = ({
  product,
  size = 'md',
  align = 'end',
  showBadge = true,
  className,
}: ProductPriceDisplayProps) => {
  const sale = getProductSalePrice(product);
  const list = getProductListPrice(product);
  const onSale = hasPromotionalPricing(product);
  const badge = showBadge ? getDiscountBadgeLabel(product) : null;
  const s = sizeClasses[size];

  return (
    <div
      className={cn(
        'flex flex-col gap-1',
        align === 'end' ? 'items-end text-right' : 'items-start text-left',
        className
      )}
    >
      {onSale && list != null && (
        <span className={cn('text-muted-foreground line-through font-medium opacity-70', s.list)}>
          {formatStorePrice(list)}
        </span>
      )}
      <span
        className={cn(
          'font-extrabold tracking-tight leading-none',
          onSale ? 'text-destructive' : 'text-foreground',
          s.sale
        )}
      >
        {formatStorePrice(sale)}
      </span>
      {badge && showBadge && size !== 'lg' && (
        <span className={cn('inline-flex items-center rounded-full bg-destructive/10 text-destructive font-bold', s.badge)}>
          وفّر {badge.replace(/^-/, '')}
        </span>
      )}
    </div>
  );
};

export default ProductPriceDisplay;
