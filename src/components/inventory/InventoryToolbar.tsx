import { useMemo, useState } from 'react';
import {
  Search,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  Filter,
  LayoutGrid,
  Table2,
  SlidersHorizontal,
  Clock,
  BookmarkPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type {
  InventoryAdvancedFilters,
  InventoryFilterPreset,
  InventorySort,
  InventoryViewMode,
  LifecycleFilter,
  StockFilter,
} from '@/utils/inventoryPageUtils';

const stockFilters: { value: StockFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'الكل', icon: <Package className="w-3.5 h-3.5" /> },
  { value: 'good', label: 'متوفر', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  { value: 'low', label: 'منخفض', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { value: 'out', label: 'نفد', icon: <XCircle className="w-3.5 h-3.5" /> },
];

const lifecycleFilters: { value: LifecycleFilter; label: string }[] = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'published', label: 'منشور' },
  { value: 'draft', label: 'مسودة' },
  { value: 'archived', label: 'مؤرشف' },
];

type InventoryToolbarProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  recentSearches: string[];
  onRecentSearch: (value: string) => void;
  stockFilter: StockFilter;
  onStockFilterChange: (value: StockFilter) => void;
  lifecycleFilter: LifecycleFilter;
  onLifecycleFilterChange: (value: LifecycleFilter) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  categories: string[];
  sort: InventorySort;
  onSortChange: (value: InventorySort) => void;
  lowStockOnly: boolean;
  onLowStockOnlyChange: (value: boolean) => void;
  showLowStockToggle: boolean;
  viewMode: InventoryViewMode;
  onViewModeChange: (mode: InventoryViewMode) => void;
  advanced: InventoryAdvancedFilters;
  onAdvancedChange: (patch: Partial<InventoryAdvancedFilters>) => void;
  onClearAdvanced: () => void;
  filterPresets: InventoryFilterPreset[];
  onSavePreset: () => void;
  onApplyPreset: (preset: InventoryFilterPreset) => void;
  activeFilterCount: number;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
};

const InventoryToolbar = ({
  searchTerm,
  onSearchChange,
  recentSearches,
  onRecentSearch,
  stockFilter,
  onStockFilterChange,
  lifecycleFilter,
  onLifecycleFilterChange,
  category,
  onCategoryChange,
  categories,
  sort,
  onSortChange,
  lowStockOnly,
  onLowStockOnlyChange,
  showLowStockToggle,
  viewMode,
  onViewModeChange,
  advanced,
  onAdvancedChange,
  onClearAdvanced,
  filterPresets,
  onSavePreset,
  onApplyPreset,
  activeFilterCount,
  searchInputRef,
}: InventoryToolbarProps) => {
  const [searchFocused, setSearchFocused] = useState(false);

  const showSuggestions = searchFocused && !searchTerm && recentSearches.length > 0;

  const advancedActive = useMemo(
    () =>
      advanced.hasImage != null ||
      advanced.hasVariants != null ||
      advanced.missingSku ||
      advanced.priceMin != null ||
      advanced.priceMax != null ||
      advanced.qtyMin != null ||
      advanced.qtyMax != null,
    [advanced]
  );

  return (
    <Card>
      <CardContent className="p-3 sm:p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
            <Input
              ref={searchInputRef}
              placeholder="بحث: اسم، SKU، تصنيف..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              className="pr-10 rounded-xl h-11"
            />
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl border border-border bg-card shadow-lg p-2 text-right">
                <p className="text-[10px] font-semibold text-muted-foreground px-2 py-1 flex items-center gap-1 justify-end">
                  <Clock className="w-3 h-3" />
                  عمليات بحث سابقة
                </p>
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    className="w-full text-right px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
                    onMouseDown={() => onRecentSearch(term)}
                  >
                    {term}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-xl p-1 shrink-0">
            <button
              type="button"
              onClick={() => onViewModeChange('cards')}
              className={cn(
                'p-2 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center',
                viewMode === 'cards' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground'
              )}
              aria-label="عرض بطاقات"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              className={cn(
                'p-2 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center',
                viewMode === 'table' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground'
              )}
              aria-label="عرض جدول"
            >
              <Table2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
          {stockFilters.map((f) => (
            <Button
              key={f.value}
              variant={stockFilter === f.value ? 'default' : 'outline'}
              size="sm"
              className={cn('rounded-xl gap-1.5 shrink-0 h-9', stockFilter !== f.value && 'border-border/30 bg-card/80')}
              onClick={() => onStockFilterChange(f.value)}
            >
              {f.icon}
              {f.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger className="h-9 rounded-xl text-xs sm:text-sm w-[min(100%,140px)]">
              <SelectValue placeholder="التصنيف" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل التصنيفات</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={lifecycleFilter} onValueChange={(v) => onLifecycleFilterChange(v as LifecycleFilter)}>
            <SelectTrigger className="h-9 rounded-xl text-xs sm:text-sm w-[min(100%,130px)]">
              <SelectValue placeholder="حالة النشر" />
            </SelectTrigger>
            <SelectContent>
              {lifecycleFilters.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(v) => onSortChange(v as InventorySort)}>
            <SelectTrigger className="h-9 rounded-xl text-xs sm:text-sm w-[min(100%,150px)]">
              <ArrowUpDown className="w-3.5 h-3.5 ml-1.5 shrink-0 opacity-60" />
              <SelectValue placeholder="الترتيب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stock_asc">الأقل مخزوناً</SelectItem>
              <SelectItem value="stock_desc">الأعلى مخزوناً</SelectItem>
              <SelectItem value="value_desc">أعلى قيمة</SelectItem>
              <SelectItem value="profit_desc">أعلى ربح</SelectItem>
              <SelectItem value="name">الاسم</SelectItem>
              <SelectItem value="recent">الأحدث</SelectItem>
            </SelectContent>
          </Select>

          {showLowStockToggle && (
            <Button
              type="button"
              variant={lowStockOnly ? 'default' : 'outline'}
              size="sm"
              className={cn('h-9 rounded-xl gap-1.5', !lowStockOnly && 'border-border/30 bg-card/80')}
              onClick={() => onLowStockOnlyChange(!lowStockOnly)}
            >
              <Filter className="w-3.5 h-3.5" />
              الناقص فقط
            </Button>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant={advancedActive || activeFilterCount > 0 ? 'default' : 'outline'}
                size="sm"
                className="h-9 rounded-xl gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                فلاتر متقدمة
                {activeFilterCount > 0 && (
                  <span className="bg-primary-foreground/20 text-[10px] rounded-full px-1.5">{activeFilterCount}</span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto text-right">
              <SheetHeader>
                <SheetTitle className="text-right">فلاتر متقدمة</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-right block">الصورة</Label>
                  <Select
                    value={
                      advanced.hasImage == null ? 'all' : advanced.hasImage ? 'yes' : 'no'
                    }
                    onValueChange={(v) =>
                      onAdvancedChange({
                        hasImage: v === 'all' ? null : v === 'yes',
                      })
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="yes">مع صورة</SelectItem>
                      <SelectItem value="no">بدون صورة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-right block">المتغيرات</Label>
                  <Select
                    value={
                      advanced.hasVariants == null ? 'all' : advanced.hasVariants ? 'yes' : 'no'
                    }
                    onValueChange={(v) =>
                      onAdvancedChange({
                        hasVariants: v === 'all' ? null : v === 'yes',
                      })
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="yes">مع متغيرات</SelectItem>
                      <SelectItem value="no">بدون متغيرات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(advanced.missingSku)}
                    onChange={(e) => onAdvancedChange({ missingSku: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">بدون SKU فقط</span>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>أقل سعر</Label>
                    <Input
                      type="number"
                      min={0}
                      value={advanced.priceMin ?? ''}
                      onChange={(e) =>
                        onAdvancedChange({
                          priceMin: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>أعلى سعر</Label>
                    <Input
                      type="number"
                      min={0}
                      value={advanced.priceMax ?? ''}
                      onChange={(e) =>
                        onAdvancedChange({
                          priceMax: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>أقل كمية</Label>
                    <Input
                      type="number"
                      min={0}
                      value={advanced.qtyMin ?? ''}
                      onChange={(e) =>
                        onAdvancedChange({
                          qtyMin: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>أعلى كمية</Label>
                    <Input
                      type="number"
                      min={0}
                      value={advanced.qtyMax ?? ''}
                      onChange={(e) =>
                        onAdvancedChange({
                          qtyMax: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onClearAdvanced}>
                    مسح
                  </Button>
                  <Button type="button" className="flex-1 rounded-xl gap-1.5" onClick={onSavePreset}>
                    <BookmarkPlus className="w-4 h-4" />
                    حفظ فلتر
                  </Button>
                </div>

                {filterPresets.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <Label>فلاتر محفوظة</Label>
                    {filterPresets.map((preset) => (
                      <Button
                        key={preset.id}
                        type="button"
                        variant="outline"
                        className="w-full rounded-xl justify-end h-10"
                        onClick={() => onApplyPreset(preset)}
                      >
                        {preset.name}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </CardContent>
    </Card>
  );
};

export default InventoryToolbar;
