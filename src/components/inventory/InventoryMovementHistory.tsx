import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ArrowDownLeft, ArrowUpRight, History, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchProductMovements } from '@/services/inventoryService';
import { cn } from '@/lib/utils';
import {
  formatMovementDayLabel,
  formatMovementReason,
  groupMovementsByDay,
  summarizeMovements,
  type InventoryMovementRow,
} from '@/utils/inventoryPageUtils';

type InventoryMovementHistoryProps = {
  productId: string;
  active: boolean;
  refreshKey?: number;
};

const InventoryMovementHistory = ({ productId, active, refreshKey = 0 }: InventoryMovementHistoryProps) => {
  const [movements, setMovements] = useState<InventoryMovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchProductMovements(productId, 20);
      setMovements(data);
      setLoadedOnce(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!active || !productId) return;
    void load();
  }, [active, productId, refreshKey]);

  const summary = useMemo(() => summarizeMovements(movements), [movements]);
  const grouped = useMemo(() => groupMovementsByDay(movements), [movements]);

  if (!active && !loadedOnce) return null;

  if (loading && !loadedOnce) {
    return (
      <div className="space-y-3 mt-4">
        <Skeleton className="h-16 rounded-xl" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-10 text-center">
        <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">لا توجد حركات بعد</p>
        <p className="mt-1 text-xs text-muted-foreground">
          ستظهر هنا عمليات التعبئة وخصم الطلبات تلقائياً
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/50 bg-muted/20 p-2.5 text-center">
        <div>
          <p className="text-[10px] text-muted-foreground">مضاف</p>
          <p className="text-sm font-bold tabular-nums text-emerald-600">+{summary.added}</p>
        </div>
        <div className="border-x border-border/40">
          <p className="text-[10px] text-muted-foreground">مخصوم</p>
          <p className="text-sm font-bold tabular-nums text-destructive">-{summary.removed}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">الصافي</p>
          <p
            className={cn(
              'text-sm font-bold tabular-nums',
              summary.net >= 0 ? 'text-foreground' : 'text-destructive'
            )}
          >
            {summary.net >= 0 ? `+${summary.net}` : summary.net}
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-lg text-xs gap-1.5 text-muted-foreground"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          تحديث
        </Button>
      </div>

      <div className="space-y-4 max-h-[min(50dvh,320px)] overflow-y-auto pr-0.5">
        {grouped.map(({ day, items }) => (
          <section key={day}>
            <p className="mb-2 text-[11px] font-semibold text-muted-foreground text-right sticky top-0 bg-background/95 py-1 backdrop-blur-sm">
              {formatMovementDayLabel(day)}
            </p>
            <ul className="space-y-1.5">
              {items.map((m) => {
                const isAdd = m.quantity_delta >= 0;
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-card px-3 py-2.5"
                    dir="rtl"
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        isAdd
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-destructive/10 text-destructive'
                      )}
                    >
                      {isAdd ? (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDownLeft className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1 text-right">
                      <p className="text-xs font-medium leading-snug">{formatMovementReason(m.reason)}</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {format(new Date(m.created_at), 'HH:mm', { locale: ar })}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'text-sm font-bold tabular-nums shrink-0 min-w-[2rem] text-left dir-ltr',
                        isAdd ? 'text-emerald-600' : 'text-destructive'
                      )}
                    >
                      {isAdd ? `+${m.quantity_delta}` : m.quantity_delta}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
};

export default InventoryMovementHistory;
