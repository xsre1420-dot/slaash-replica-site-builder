import { Search, LayoutGrid, List, SlidersHorizontal } from 'lucide-react';
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
  PRODUCT_SORT_OPTIONS,
  type ProductCatalogFilters,
  type ProductStockFilter,
} from '@/utils/productCatalogPageUtils';

export type ProductViewMode = 'grid' | 'table';

type ProductsToolbarProps = {
  filters: ProductCatalogFilters;
  onChange: (patch: Partial<ProductCatalogFilters>) => void;
  categories: string[];
  viewMode: ProductViewMode;
  onViewModeChange: (mode: ProductViewMode) => void;
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
];

const ProductsToolbar = ({
  filters,
  onChange,
  categories,
  viewMode,
  onViewModeChange,
  resultCount,
  totalCount,
  embedded = false,
  onClearFilters,
  filtersActive = false,
}: ProductsToolbarProps) => {
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
              placeholder="بحث بالاسم أو التصنيف..."
              value={filters.search}
              onChange={(e) => onChange({ search: e.target.value })}
              className="pr-10 pl-3 rounded-xl border-border/60 bg-background/50 min-h-[44px] w-full focus-visible:ring-primary/25"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-0.5"
              role="group"
              aria-label="طريقة العرض"
            >
              <Button
                type="button"
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className="h-9 px-3 rounded-lg gap-1.5 text-xs"
                onClick={() => onViewModeChange('grid')}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">شبكة</span>
              </Button>
              <Button
                type="button"
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                className="h-9 px-3 rounded-lg gap-1.5 text-xs hidden sm:inline-flex"
                onClick={() => onViewModeChange('table')}
              >
                <List className="h-3.5 w-3.5" />
                جدول
              </Button>
            </div>

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

          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-3 gap-2 min-w-0">
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
                <SelectValue placeholder="المخزون" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {stockOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.sort}
              onValueChange={(v) => onChange({ sort: v as ProductCatalogFilters['sort'] })}
            >
              <SelectTrigger className="rounded-xl min-h-[42px] w-full bg-background/50 border-border/60 text-sm min-[400px]:col-span-2 lg:col-span-1">
                <SelectValue placeholder="الترتيب" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {PRODUCT_SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductsToolbar;
