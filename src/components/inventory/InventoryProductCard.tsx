import { Link } from 'react-router-dom';
import { Package, PackagePlus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getAvailableQty } from '@/utils/inventoryUtils';
import {
  getInventoryStockStatus,
  getStockLevelPercent,
  lifecycleBadgeClasses,
  lifecycleStatusLabel,
  stockStatusBadgeClasses,
  toInventoryProduct,
  type InventoryProductRow,
} from '@/utils/inventoryPageUtils';

type InventoryProductCardProps = {
  product: InventoryProductRow;
  onRestock: (product: InventoryProductRow) => void;
};

const InventoryProductCard = ({ product, onRestock }: InventoryProductCardProps) => {
  const stockStatus = getInventoryStockStatus(product);
  const availableQty = getAvailableQty(toInventoryProduct(product));
  const minLevel = product.min_stock_level || 5;
  const levelPercent = getStockLevelPercent(product);
  const needsRestock = stockStatus.status === 'low' || stockStatus.status === 'out';

  const progressClass =
    stockStatus.status === 'out'
      ? '[&>div]:bg-destructive'
      : stockStatus.status === 'low'
        ? '[&>div]:bg-amber-500'
        : '[&>div]:bg-emerald-500';

  return (
    <Card
      className={cn(
        'overflow-hidden hover:border-primary/15 transition-colors',
        needsRestock && 'border-amber-500/25'
      )}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt=""
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover shrink-0"
              />
            ) : (
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
              </div>
            )}

            <div className="min-w-0 flex-1 text-right">
              <div className="flex flex-wrap items-center gap-1.5 justify-end mb-1">
                <Badge variant="outline" className={cn('text-[10px]', lifecycleBadgeClasses(product.lifecycle))}>
                  {lifecycleStatusLabel[product.lifecycle]}
                </Badge>
                <Badge variant="outline" className={cn('text-[10px]', stockStatusBadgeClasses(stockStatus.status))}>
                  {stockStatus.label}
                </Badge>
              </div>
              <h3 className="font-semibold text-sm truncate">{product.name}</h3>
              <p className="text-xs text-muted-foreground">
                {product.category}
                {product.sku ? ` · ${product.sku}` : ''}
              </p>

              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>{availableQty} / حد {minLevel}</span>
                  <span>{levelPercent}%</span>
                </div>
                <Progress value={levelPercent} className={cn('h-1.5', progressClass)} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-stretch sm:gap-2 shrink-0 border-t border-border/40 pt-3 sm:border-0 sm:pt-0 sm:min-w-[7.5rem]">
            <div className="text-right sm:text-center">
              <p className="text-[11px] text-muted-foreground">المتوفر</p>
              <p
                className={cn(
                  'text-xl font-bold tabular-nums',
                  stockStatus.status === 'out' && 'text-destructive',
                  stockStatus.status === 'low' && 'text-amber-600 dark:text-amber-400'
                )}
              >
                {availableQty}
              </p>
            </div>

            <div className="flex items-center gap-1.5 sm:flex-col sm:w-full">
              <Button
                type="button"
                variant={needsRestock ? 'default' : 'outline'}
                size="sm"
                className="h-9 rounded-xl px-3 shrink-0 sm:w-full gap-1.5"
                onClick={() => onRestock(product)}
              >
                <PackagePlus className="w-3.5 h-3.5" />
                إعادة تعبئة
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl shrink-0 text-muted-foreground sm:hidden"
                asChild
              >
                <Link to={`/edit-product/${product.id}`} aria-label="فتح المنتج">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InventoryProductCard;
