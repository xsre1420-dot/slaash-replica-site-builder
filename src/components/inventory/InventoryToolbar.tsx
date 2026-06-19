import {
  Search,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { InventorySort, LifecycleFilter, StockFilter } from '@/utils/inventoryPageUtils';

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
};

const InventoryToolbar = ({
  searchTerm,
  onSearchChange,
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
}: InventoryToolbarProps) => (
  <Card>
    <CardContent className="p-3 sm:p-4 space-y-3">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
        <Input
          placeholder="بحث بالاسم أو التصنيف..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pr-10 rounded-xl h-10"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scrollbar-none">
        {stockFilters.map((f) => (
          <Button
            key={f.value}
            variant={stockFilter === f.value ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'rounded-xl gap-1.5 shrink-0 h-9',
              stockFilter !== f.value && 'border-border/30 bg-card/80'
            )}
            onClick={() => onStockFilterChange(f.value)}
          >
            {f.icon}
            {f.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger className="h-9 rounded-xl text-xs sm:text-sm">
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
          <SelectTrigger className="h-9 rounded-xl text-xs sm:text-sm">
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
          <SelectTrigger className="h-9 rounded-xl text-xs sm:text-sm col-span-2 sm:col-span-1">
            <ArrowUpDown className="w-3.5 h-3.5 ml-1.5 shrink-0 opacity-60" />
            <SelectValue placeholder="الترتيب" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stock_asc">الأقل مخزوناً</SelectItem>
            <SelectItem value="stock_desc">الأعلى مخزوناً</SelectItem>
            <SelectItem value="name">الاسم</SelectItem>
            <SelectItem value="recent">الأحدث</SelectItem>
          </SelectContent>
        </Select>

        {showLowStockToggle && (
          <Button
            type="button"
            variant={lowStockOnly ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'h-9 rounded-xl gap-1.5 text-xs sm:text-sm',
              !lowStockOnly && 'border-border/30 bg-card/80'
            )}
            onClick={() => onLowStockOnlyChange(!lowStockOnly)}
          >
            <Filter className="w-3.5 h-3.5" />
            الناقص فقط
          </Button>
        )}
      </div>
    </CardContent>
  </Card>
);

export default InventoryToolbar;
