import { memo } from 'react';
import { Eye, ImageOff, TrendingUp } from 'lucide-react';
import { formatDisplayPrice } from '@/lib/productFormUtils';

interface ProductPreviewCardProps {
  name: string;
  price: string;
  compareAtPrice?: string;
  image: string | null;
  category: string;
  shortDescription?: string;
  isActive?: boolean;
  profitMargin?: number | null;
}

const ProductPreviewCard = memo(function ProductPreviewCard({
  name,
  price,
  compareAtPrice,
  image,
  category,
  shortDescription,
  isActive = true,
  profitMargin,
}: ProductPreviewCardProps) {
  const displayPrice = () => {
    if (!price) return '٠';
    const num = parseFloat(price.replace(/,/g, ''));
    if (isNaN(num) || num === 0) return '٠';
    return num.toLocaleString('en-US');
  };

  const displayCompare = () => {
    if (!compareAtPrice) return null;
    const num = parseFloat(compareAtPrice.replace(/,/g, ''));
    if (isNaN(num) || num <= 0) return null;
    return num.toLocaleString('en-US');
  };

  const compare = displayCompare();

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/50 bg-muted/20">
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isActive ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
          }`}
        >
          {isActive ? 'منشور' : 'مسودة'}
        </span>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Eye className="w-4 h-4" />
          <span className="text-sm font-medium">معاينة المتجر</span>
        </div>
      </div>

      <div className="p-4">
        <div className="rounded-xl overflow-hidden bg-muted aspect-square mb-3 flex items-center justify-center">
          {image ? (
            <img src={image} alt={name || 'منتج'} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageOff className="w-10 h-10" />
              <span className="text-xs">أضف صورة</span>
            </div>
          )}
        </div>

        <div className="space-y-2 text-right">
          <h3 className="font-bold text-foreground line-clamp-2">{name || 'اسم المنتج'}</h3>
          {shortDescription && (
            <p className="text-xs text-muted-foreground line-clamp-2">{shortDescription}</p>
          )}
          {category && (
            <span className="inline-block text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {category}
            </span>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            {compare && (
              <span className="text-sm text-muted-foreground line-through">{compare}</span>
            )}
            <p className="text-primary font-bold text-xl">
              {displayPrice()} <span className="text-xs text-muted-foreground font-normal">د.ع</span>
            </p>
          </div>
          {profitMargin != null && profitMargin > 0 && (
            <p className="text-[11px] text-success flex items-center justify-end gap-1">
              <TrendingUp className="w-3 h-3" />
              هامش ربح {profitMargin}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

export default ProductPreviewCard;
