import { Link } from 'react-router-dom';
import {
  Edit,
  Copy,
  Eye,
  Archive,
  ArchiveRestore,
  MessageSquare,
  Lightbulb,
  MoreHorizontal,
  PackagePlus,
} from 'lucide-react';
import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import OptimizedImage from '@/components/OptimizedImage';
import { getProductLifecycleStatus, lifecycleStatusLabel } from '@/lib/productLifecycle';
import { cn } from '@/lib/utils';
import {
  getInventoryStockStatus,
  getRowAvailableQty,
  productToInventoryRow,
  stockStatusBadgeClasses,
} from '@/utils/inventoryPageUtils';
import { getProductCatalogStockStatus } from '@/utils/productCatalogPageUtils';

interface ProductsDataTableProps {
  products: Product[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  onDuplicate: (product: Product) => void;
  onPublish: (product: Product) => void;
  onArchive: (product: Product) => void;
  onRestore: (product: Product) => void;
  onRestock?: (product: Product) => void;
}

const lifecycleBadgeClass: Record<string, string> = {
  published: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  draft: 'bg-amber-500/15 text-amber-700 border-amber-500/25',
  archived: 'bg-muted text-muted-foreground border-border',
};

const ProductsDataTable = ({
  products,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  onDuplicate,
  onPublish,
  onArchive,
  onRestore,
  onRestock,
}: ProductsDataTableProps) => (
  <div className="rounded-2xl border border-border/60 overflow-hidden bg-card min-w-0">
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]" dir="rtl">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30 text-muted-foreground text-xs">
            <th className="p-3 w-10">
              <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} aria-label="تحديد الكل" />
            </th>
            <th className="p-3 text-right font-medium">المنتج</th>
            <th className="p-3 text-right font-medium hidden md:table-cell">التصنيف</th>
            <th className="p-3 text-right font-medium">الحالة</th>
            <th className="p-3 text-right font-medium">السعر</th>
            <th className="p-3 text-right font-medium hidden sm:table-cell">حالة المخزون</th>
            <th className="p-3 text-right font-medium">المخزون</th>
            <th className="p-3 text-left font-medium w-28">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const lifecycle = getProductLifecycleStatus(product);
            const selected = selectedIds.has(product.id);
            const invRow = productToInventoryRow(product);
            const stockStatus = getInventoryStockStatus(invRow);
            const catalogStatus = getProductCatalogStockStatus(product);
            const qty = getRowAvailableQty(invRow);
            const unlimited = catalogStatus === 'unlimited';

            return (
              <tr
                key={product.id}
                className={cn(
                  'border-b border-border/30 hover:bg-muted/20 transition-colors group',
                  selected && 'bg-primary/5',
                  (stockStatus.status === 'low' || stockStatus.status === 'out') &&
                    'bg-amber-500/[0.02]'
                )}
              >
                <td className="p-3">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggleSelect(product.id)}
                    aria-label={`تحديد ${product.name}`}
                  />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <OptimizedImage
                      src={product.image}
                      alt={product.name}
                      className="h-11 w-11 rounded-lg shrink-0 object-cover"
                    />
                    <div className="min-w-0 text-right">
                      <p className="font-semibold text-foreground truncate max-w-[200px] lg:max-w-xs">
                        {product.name}
                      </p>
                      {product.sku && (
                        <p className="text-[10px] text-muted-foreground truncate">{product.sku}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground hidden md:table-cell">{product.category || '—'}</td>
                <td className="p-3">
                  <span
                    className={cn(
                      'inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-md border',
                      lifecycleBadgeClass[lifecycle]
                    )}
                  >
                    {lifecycleStatusLabel[lifecycle]}
                  </span>
                </td>
                <td className="p-3 font-semibold tabular-nums whitespace-nowrap">
                  {product.price.toLocaleString()} د.ع
                </td>
                <td className="p-3 hidden sm:table-cell">
                  <span
                    className={cn(
                      'inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap',
                      unlimited
                        ? 'bg-sky-500/10 text-sky-700 border-sky-500/20'
                        : stockStatusBadgeClasses(stockStatus.status)
                    )}
                  >
                    {unlimited ? 'غير محدود' : stockStatus.label}
                  </span>
                </td>
                <td className="p-3">
                  {onRestock ? (
                    <button
                      type="button"
                      onClick={() => onRestock(product)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -mx-2 transition-colors',
                        'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        stockStatus.status === 'out' && 'text-destructive font-medium',
                        stockStatus.status === 'low' && 'text-warning font-medium'
                      )}
                      title="تعديل المخزون"
                    >
                      <span className="tabular-nums">{unlimited ? '∞' : qty}</span>
                      <PackagePlus className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:opacity-100" />
                    </button>
                  ) : (
                    <span
                      className={cn(
                        'tabular-nums',
                        stockStatus.status === 'out' && 'text-destructive font-medium',
                        stockStatus.status === 'low' && 'text-warning font-medium'
                      )}
                    >
                      {unlimited ? '∞' : qty}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link to={`/edit-product/${product.id}`}>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        {onRestock && (
                          <>
                            <DropdownMenuItem onClick={() => onRestock(product)}>
                              <PackagePlus className="h-4 w-4 ml-2" />
                              تعديل المخزون
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {lifecycle === 'draft' && (
                          <DropdownMenuItem onClick={() => onPublish(product)}>
                            <Eye className="h-4 w-4 ml-2" />
                            نشر
                          </DropdownMenuItem>
                        )}
                        {lifecycle === 'published' && (
                          <DropdownMenuItem onClick={() => onArchive(product)}>
                            <Archive className="h-4 w-4 ml-2" />
                            أرشفة
                          </DropdownMenuItem>
                        )}
                        {lifecycle === 'archived' && (
                          <DropdownMenuItem onClick={() => onRestore(product)}>
                            <ArchiveRestore className="h-4 w-4 ml-2" />
                            استرجاع
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onDuplicate(product)}>
                          <Copy className="h-4 w-4 ml-2" />
                          تكرار
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link
                            to={`/products/reviews/${product.id}`}
                            state={{ productName: product.name }}
                          >
                            <MessageSquare className="h-4 w-4 ml-2" />
                            التعليقات
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            to={`/products/suggestions/${product.id}`}
                            state={{ productName: product.name }}
                          >
                            <Lightbulb className="h-4 w-4 ml-2" />
                            منتجات تحته
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

export default ProductsDataTable;
