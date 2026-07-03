import { Link } from 'react-router-dom';
import { PackagePlus, MoreHorizontal, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import OptimizedImage from '@/components/OptimizedImage';
import { cn } from '@/lib/utils';
import {
  getInventoryStockStatus,
  getRowAvailableQty,
  getRowMarginPercent,
  getRowProfit,
  getRowRetailValue,
  lifecycleBadgeClasses,
  lifecycleStatusLabel,
  stockStatusBadgeClasses,
  type InventoryProductRow,
} from '@/utils/inventoryPageUtils';

interface InventoryDataTableProps {
  products: InventoryProductRow[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  onRestock: (product: InventoryProductRow) => void;
}

const InventoryDataTable = ({
  products,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  onRestock,
}: InventoryDataTableProps) => (
  <div className="rounded-2xl border border-border/60 overflow-hidden bg-card min-w-0">
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[880px]" dir="rtl">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30 text-muted-foreground text-[11px]">
            <th className="p-3 w-10 sticky right-0 bg-muted/30 z-10">
              <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} aria-label="تحديد الكل" />
            </th>
            <th className="p-3 text-right font-semibold min-w-[200px]">المنتج</th>
            <th className="p-3 text-right font-semibold hidden lg:table-cell">SKU</th>
            <th className="p-3 text-right font-semibold hidden md:table-cell">التصنيف</th>
            <th className="p-3 text-right font-semibold">المتوفر</th>
            <th className="p-3 text-right font-semibold hidden sm:table-cell">الحد</th>
            <th className="p-3 text-right font-semibold hidden xl:table-cell">قيمة البيع</th>
            <th className="p-3 text-right font-semibold hidden xl:table-cell">الربح</th>
            <th className="p-3 text-right font-semibold">الحالة</th>
            <th className="p-3 text-left font-semibold w-24 sticky left-0 bg-muted/30 z-10">إجراء</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const selected = selectedIds.has(product.id);
            const stockStatus = getInventoryStockStatus(product);
            const qty = getRowAvailableQty(product);
            const minLevel = product.min_stock_level || 5;
            const margin = getRowMarginPercent(product);

            return (
              <tr
                key={product.id}
                className={cn(
                  'border-b border-border/30 hover:bg-muted/20 transition-colors group',
                  selected && 'bg-primary/5',
                  (stockStatus.status === 'low' || stockStatus.status === 'out') && 'bg-amber-500/[0.02]'
                )}
              >
                <td className="p-3 sticky right-0 bg-card group-hover:bg-muted/20 z-[1]">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggleSelect(product.id)}
                    aria-label={`تحديد ${product.name}`}
                  />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {product.image_url ? (
                      <OptimizedImage
                        src={product.image_url}
                        alt={product.name}
                        className="h-11 w-11 rounded-xl shrink-0 object-cover"
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        <PackagePlus className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 text-right">
                      <p className="font-semibold text-foreground truncate max-w-[180px] lg:max-w-xs">
                        {product.name}
                      </p>
                      <span
                        className={cn(
                          'inline-flex mt-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded border',
                          lifecycleBadgeClasses(product.lifecycle)
                        )}
                      >
                        {lifecycleStatusLabel[product.lifecycle]}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground text-xs hidden lg:table-cell font-mono">
                  {product.sku || '—'}
                </td>
                <td className="p-3 text-muted-foreground text-xs hidden md:table-cell">{product.category || '—'}</td>
                <td className="p-3">
                  <span
                    className={cn(
                      'font-bold tabular-nums',
                      stockStatus.status === 'out' && 'text-destructive',
                      stockStatus.status === 'low' && 'text-amber-600'
                    )}
                  >
                    {qty}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground tabular-nums text-xs hidden sm:table-cell">{minLevel}</td>
                <td className="p-3 tabular-nums text-xs hidden xl:table-cell">
                  {getRowRetailValue(product).toLocaleString()}
                </td>
                <td className="p-3 hidden xl:table-cell">
                  <div className="text-xs tabular-nums text-right">
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {getRowProfit(product).toLocaleString()}
                    </p>
                    {margin != null && (
                      <p className="text-[10px] text-muted-foreground">{margin}%</p>
                    )}
                    {!product.cost && (
                      <p className="text-[10px] text-muted-foreground">بدون تكلفة</p>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <span
                    className={cn(
                      'inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap',
                      stockStatusBadgeClasses(stockStatus.status)
                    )}
                  >
                    {stockStatus.label}
                  </span>
                </td>
                <td className="p-3 sticky left-0 bg-card group-hover:bg-muted/20 z-[1]">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-right">
                      <DropdownMenuItem onClick={() => onRestock(product)} className="gap-2">
                        <PackagePlus className="w-4 h-4" />
                        إعادة تعبئة
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={`/edit-product/${product.id}`} className="gap-2 flex items-center">
                          <ExternalLink className="w-4 h-4" />
                          فتح المنتج
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

export default InventoryDataTable;
