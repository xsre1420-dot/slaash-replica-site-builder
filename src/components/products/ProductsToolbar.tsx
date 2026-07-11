import { useRef } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  type ProductCatalogFilters,
  type ProductStockFilter,
} from '@/utils/productCatalogPageUtils';

type ProductsToolbarProps = {
  filters: ProductCatalogFilters;
  onChange: (patch: Partial<ProductCatalogFilters>) => void;
  categories: string[];
  resultCount: number;
  totalCount: number;
  embedded?: boolean;
  onClearFilters?: () => void;
  filtersActive?: boolean;
};

const stockOptions: { value: ProductStockFilter; label: string }[] = [
  { value: 'all', label: 'كل المخزون' },
  { value: 'in_stock', label: 'متوفر' },
  { value: 'low', label: 'منخفض' },
  { value: 'out', label: 'نفد' },
  { value: 'unlimited', label: 'غير محدود' },
];

const ProductsToolbar = ({
  filters,
  onChange,
  categories,
  resultCount,
  totalCount,
  embedded = false,
  onClearFilters,
  filtersActive = false,
}: ProductsToolbarProps) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const shellClass = embedded
    ? 'min-w-0'
    : 'rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden min-w-0';

  return (
    <div className={shellClass}>
      <div
        className={cn(
          'p-3 sm:p-4 space-y-3',
          embedded && 'pt-0 sm:pt-0'
        )}
      >
        {/* Search row */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
            <Input
              ref={searchInputRef}
              placeholder="بحث بالاسم أو التصنيف..."
              value={filters.search}
              onChange={(e) => onChange({ search: e.target.value })}
              className="pr-10 pl-3 rounded-xl border-border/60 bg-background/50 min-h-[44px] w-full focus-visible:ring-primary/25"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="secondary"
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-xs font-semibold tabular-nums shrink-0 min-h-[36px] flex items-center',
                resultCount !== totalCount && 'bg-warning/15 text-warning border-warning/20'
              )}
            >
              {resultCount === totalCount ? `${totalCount} منتج` : `${resultCount}/${totalCount}`}
            </Badge>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-col gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground px-0.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>الفلاتر</span>
            {filtersActive && onClearFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="mr-auto text-primary hover:underline text-[11px] font-semibold"
              >
                مسح الكل
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 min-[400px]:grid-cols-[1fr_1fr_auto] gap-2 min-w-0">
            <Select value={filters.category} onValueChange={(v) => onChange({ category: v })}>
              <SelectTrigger className="rounded-xl min-h-[42px] w-full bg-background/50 border-border/60 text-sm">
                <SelectValue placeholder="الفئة" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">جميع الفئات</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.stock} onValueChange={(v) => onChange({ stock: v as ProductStockFilter })}>
              <SelectTrigger className="rounded-xl min-h-[42px] w-full bg-background/50 border-border/60 text-sm">
                <SelectValue placeholder="حالة المخزون" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {stockOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-xl min-h-[42px] w-full min-[400px]:w-[42px] shrink-0 border-border/60 bg-background/50"
              aria-label="بحث"
              onClick={() => {
                searchInputRef.current?.focus();
                searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductsToolbar;
