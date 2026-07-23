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

/** Data columns + narrow actions slot */
const DESKTOP_GRID =
  'grid grid-cols-[minmax(0,1.32fr)_minmax(0,1fr)_minmax(0,0.72fr)_minmax(0,0.88fr)_minmax(0,1.05fr)_minmax(0,0.62fr)_1.75rem] items-center gap-x-3';

const ROW_PAD = 'px-3 py-2';

const menuBtnClass =
  'h-8 w-8 min-h-0 min-w-0 rounded-lg shrink-0 p-0';

const compactStockLabel = (label: string, unlimited: boolean): string => {
  if (unlimited) return 'غير محدود';
  const short: Record<string, string> = {
    'غير معروض للبيع': 'غير معروض',
    'نفد المخزون': 'نفد',
    'مخزون منخفض': 'منخفض',
    متوفر: 'متوفر',
  };
  return short[label] ?? label;
};

const badgeBase =
  'inline-flex max-w-full items-center text-[10px] leading-none font-semibold px-1.5 py-1 rounded-md border truncate';

interface ProductRowMenuProps {
  product: Product;
  lifecycle: ReturnType<typeof getProductLifecycleStatus>;
  onDuplicate: (product: Product) => void;
  onPublish: (product: Product) => void;
  onArchive: (product: Product) => void;
  onRestore: (product: Product) => void;
  onRestock?: (product: Product) => void;
}

const ProductRowMenu = ({
  product,
  lifecycle,
  onDuplicate,
  onPublish,
  onArchive,
  onRestore,
  onRestock,
}: ProductRowMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={menuBtnClass}
        aria-label={`إجراءات ${product.name}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="rounded-xl min-w-[11rem]">
      <DropdownMenuItem asChild>
        <Link to={`/edit-product/${product.id}`}>
          <Edit className="h-4 w-4 ml-2" />
          تعديل المنتج
        </Link>
      </DropdownMenuItem>
      {onRestock && (
        <DropdownMenuItem onClick={() => onRestock(product)}>
          <PackagePlus className="h-4 w-4 ml-2" />
          تعديل المخزون
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
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
        <Link to={`/products/reviews/${product.id}`} state={{ productName: product.name }}>
          <MessageSquare className="h-4 w-4 ml-2" />
          التعليقات
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link to={`/products/suggestions/${product.id}`} state={{ productName: product.name }}>
          <Lightbulb className="h-4 w-4 ml-2" />
          منتجات تحته
        </Link>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const ProductsDataTable = ({
  products,
  onDuplicate,
  onPublish,
  onArchive,
  onRestore,
  onRestock,
}: ProductsDataTableProps) => (
  <div className="rounded-2xl border border-border/60 bg-card min-w-0 overflow-hidden">
    {/* Mobile */}
    <div className="sm:hidden divide-y divide-border/30" dir="rtl">
      {products.map((product) => {
        const lifecycle = getProductLifecycleStatus(product);
        const invRow = productToInventoryRow(product);
        const stockStatus = getInventoryStockStatus(invRow);
        const catalogStatus = getProductCatalogStockStatus(product);
        const qty = getRowAvailableQty(invRow);
        const unlimited = catalogStatus === 'unlimited';

        return (
          <div key={product.id} className="px-3 py-3 space-y-2.5">
            <div className="flex items-start gap-2 min-w-0">
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">المنتج</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <OptimizedImage
                      src={product.image}
                      alt={product.name}
                      className="h-8 w-8 rounded-md shrink-0 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[11px] text-foreground truncate">{product.name}</p>
                      {product.sku && (
                        <p className="text-[10px] text-muted-foreground truncate">{product.sku}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5">التصنيف</p>
                    <p className="text-[11px] text-muted-foreground truncate">{product.category || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5">الحالة</p>
                    <span className={cn(badgeBase, lifecycleBadgeClass[lifecycle])}>
                      {lifecycleStatusLabel[lifecycle]}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5">السعر</p>
                    <p className="text-[11px] font-semibold tabular-nums">
                      {product.price.toLocaleString()} د.ع
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5">حالة المخزون</p>
                    <span
                      className={cn(
                        badgeBase,
                        unlimited
                          ? 'bg-sky-500/10 text-sky-700 border-sky-500/20'
                          : stockStatusBadgeClasses(stockStatus.status)
                      )}
                      title={unlimited ? 'غير محدود' : stockStatus.label}
                    >
                      {compactStockLabel(stockStatus.label, unlimited)}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5">المخزون</p>
                    <p
                      className={cn(
                        'text-[11px] tabular-nums',
                        stockStatus.status === 'out' && 'text-destructive font-medium',
                        stockStatus.status === 'low' && 'text-warning font-medium'
                      )}
                    >
                      {unlimited ? '∞' : qty}
                    </p>
                  </div>
                </div>
              </div>
              <ProductRowMenu
                product={product}
                lifecycle={lifecycle}
                onDuplicate={onDuplicate}
                onPublish={onPublish}
                onArchive={onArchive}
                onRestore={onRestore}
                onRestock={onRestock}
              />
            </div>
          </div>
        );
      })}
    </div>

    {/* Desktop */}
    <div className="hidden sm:block min-w-0" dir="rtl">
      <div
        className={cn(
          DESKTOP_GRID,
          ROW_PAD,
          'border-b border-border/50 bg-muted/30 text-muted-foreground text-[10px] font-medium'
        )}
      >
        <span className="text-right truncate">المنتج</span>
        <span className="text-right truncate">التصنيف</span>
        <span className="text-right truncate">الحالة</span>
        <span className="text-right truncate">السعر</span>
        <span className="text-right truncate">حالة المخزون</span>
        <span className="text-right truncate">المخزون</span>
        <span className="sr-only">إجراءات</span>
      </div>

      <div className="divide-y divide-border/30">
        {products.map((product) => {
          const lifecycle = getProductLifecycleStatus(product);
          const invRow = productToInventoryRow(product);
          const stockStatus = getInventoryStockStatus(invRow);
          const catalogStatus = getProductCatalogStockStatus(product);
          const qty = getRowAvailableQty(invRow);
          const unlimited = catalogStatus === 'unlimited';
          const stockLabel = compactStockLabel(stockStatus.label, unlimited);

          return (
            <div
              key={product.id}
              className={cn(
                DESKTOP_GRID,
                ROW_PAD,
                'hover:bg-muted/20 transition-colors min-w-0',
                (stockStatus.status === 'low' || stockStatus.status === 'out') &&
                  'bg-amber-500/[0.02]'
              )}
            >
              <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                <OptimizedImage
                  src={product.image}
                  alt={product.name}
                  className="h-8 w-8 rounded-md shrink-0 object-cover"
                />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p
                    className="text-[11px] font-semibold text-foreground truncate leading-snug"
                    title={product.name}
                  >
                    {product.name}
                  </p>
                  {product.sku && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5" title={product.sku}>
                      {product.sku}
                    </p>
                  )}
                </div>
              </div>

              <p
                className="text-[11px] text-muted-foreground truncate text-right min-w-0"
                title={product.category || undefined}
              >
                {product.category || '—'}
              </p>

              <div className="min-w-0 flex justify-end">
                <span className={cn(badgeBase, lifecycleBadgeClass[lifecycle])}>
                  {lifecycleStatusLabel[lifecycle]}
                </span>
              </div>

              <p className="text-[11px] font-semibold tabular-nums text-right whitespace-nowrap min-w-0">
                {product.price.toLocaleString()} د.ع
              </p>

              <div className="min-w-0 flex justify-end">
                <span
                  className={cn(
                    badgeBase,
                    unlimited
                      ? 'bg-sky-500/10 text-sky-700 border-sky-500/20'
                      : stockStatusBadgeClasses(stockStatus.status)
                  )}
                  title={unlimited ? 'غير محدود' : stockStatus.label}
                >
                  {stockLabel}
                </span>
              </div>

              <p
                className={cn(
                  'text-[11px] tabular-nums text-right min-w-0',
                  stockStatus.status === 'out' && 'text-destructive font-medium',
                  stockStatus.status === 'low' && 'text-warning font-medium'
                )}
              >
                {unlimited ? '∞' : qty}
              </p>

              <div className="flex justify-center">
                <ProductRowMenu
                  product={product}
                  lifecycle={lifecycle}
                  onDuplicate={onDuplicate}
                  onPublish={onPublish}
                  onArchive={onArchive}
                  onRestore={onRestore}
                  onRestock={onRestock}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

export default ProductsDataTable;
