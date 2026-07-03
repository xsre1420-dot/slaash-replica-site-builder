import { useEffect, useState } from 'react';
import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  fetchAbcAnalysis,
  fetchInventoryForecast,
  type AbcAnalysisItem,
  type InventoryForecastItem,
} from '@/services/inventoryService';
import { cn } from '@/lib/utils';

interface InventoryAnalyticsPanelProps {
  ownerId: string;
  onRestockProduct?: (productId: string) => void;
}

const abcClassStyle: Record<string, string> = {
  A: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  B: 'bg-primary/10 text-primary border-primary/20',
  C: 'bg-muted text-muted-foreground border-border',
};

const InventoryAnalyticsPanel = ({ ownerId, onRestockProduct }: InventoryAnalyticsPanelProps) => {
  const [forecast, setForecast] = useState<InventoryForecastItem[]>([]);
  const [abc, setAbc] = useState<AbcAnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [f, a] = await Promise.all([
        fetchInventoryForecast(ownerId),
        fetchAbcAnalysis(ownerId),
      ]);
      if (!cancelled) {
        setForecast(f);
        setAbc(a);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const urgentForecast = forecast.filter(
    (f) => f.days_until_stockout != null && f.days_until_stockout <= 7
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2 justify-end mb-4">
          <h3 className="font-semibold text-foreground">توقعات الطلب</h3>
          <TrendingDown className="w-4 h-4 text-amber-600" />
        </div>
        {forecast.length === 0 ? (
          <p className="text-sm text-muted-foreground text-right">لا توجد بيانات مبيعات كافية بعد</p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {forecast.slice(0, 20).map((item) => (
              <li
                key={item.product_id}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-right',
                  item.days_until_stockout != null && item.days_until_stockout <= 7
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-border/40'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  {onRestockProduct && item.suggested_reorder_qty != null && item.suggested_reorder_qty > 0 && (
                    <button
                      type="button"
                      onClick={() => onRestockProduct(item.product_id)}
                      className="text-[10px] font-semibold text-primary hover:underline shrink-0"
                    >
                      اطلب {item.suggested_reorder_qty}
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.sold_last_30_days} مبيع / 30 يوم · متبقي {item.current_stock}
                    </p>
                  </div>
                </div>
                {item.days_until_stockout != null && (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mt-1.5">
                    ينفد خلال ~{item.days_until_stockout} يوم
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        {urgentForecast.length > 0 && (
          <p className="text-[11px] text-amber-600 mt-3 text-right">
            {urgentForecast.length} منتج قد ينفد خلال أسبوع
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2 justify-end mb-4">
          <h3 className="font-semibold text-foreground">تحليل ABC (90 يوم)</h3>
          <BarChart3 className="w-4 h-4 text-primary" />
        </div>
        {abc.length === 0 ? (
          <p className="text-sm text-muted-foreground text-right">لا توجد مبيعات في آخر 90 يوماً</p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {abc.slice(0, 25).map((item) => (
              <li
                key={item.product_id}
                className="flex items-center gap-2 rounded-xl border border-border/40 px-3 py-2.5"
                dir="rtl"
              >
                <Badge variant="outline" className={cn('text-[10px] shrink-0', abcClassStyle[item.abc_class])}>
                  {item.abc_class}
                </Badge>
                <div className="min-w-0 flex-1 text-right">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {Number(item.revenue).toLocaleString()} د.ع · {item.units_sold} وحدة
                  </p>
                </div>
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default InventoryAnalyticsPanel;
