import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, History, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchGlobalMovements, type InventoryMovementRow } from '@/services/inventoryService';
import { cn } from '@/lib/utils';
import { formatMovementDayLabel, formatMovementReason, groupMovementsByDay } from '@/utils/inventoryPageUtils';

interface InventoryMovementsPanelProps {
  ownerId: string;
}

const InventoryMovementsPanel = ({ ownerId }: InventoryMovementsPanelProps) => {
  const [movements, setMovements] = useState<InventoryMovementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchGlobalMovements(ownerId, { limit: 150 });
      setMovements(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [ownerId]);

  const grouped = useMemo(() => groupMovementsByDay(movements), [movements]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-16 text-center">
        <History className="mx-auto mb-2 h-10 w-10 text-muted-foreground/50" />
        <p className="font-medium text-foreground">لا توجد حركات في آخر 30 يوماً</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" className="rounded-xl h-9 gap-1.5" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          تحديث
        </Button>
        <p className="text-xs text-muted-foreground">{movements.length} حركة</p>
      </div>

      <div className="space-y-4 max-h-[min(70dvh,640px)] overflow-y-auto">
        {grouped.map(({ day, items }) => (
          <section key={day}>
            <p className="mb-2 text-[11px] font-semibold text-muted-foreground text-right sticky top-0 bg-background/95 py-1 backdrop-blur-sm z-10">
              {formatMovementDayLabel(day)}
            </p>
            <ul className="space-y-1.5">
              {items.map((m) => {
                const isAdd = m.quantity_delta >= 0;
                const global = m as InventoryMovementRow;
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-card px-3 py-2.5"
                    dir="rtl"
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                        isAdd ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'
                      )}
                    >
                      {isAdd ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1 text-right">
                      <p className="text-xs font-semibold truncate">
                        {global.product_name ?? 'منتج'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{formatMovementReason(m.reason)}</p>
                      <div className="flex flex-wrap gap-2 justify-end mt-0.5">
                        {global.sku && (
                          <span className="text-[10px] font-mono text-muted-foreground">{global.sku}</span>
                        )}
                        {global.order_id && (
                          <Link
                            to={`/orders/${global.order_id}`}
                            className="text-[10px] font-medium text-primary hover:underline"
                          >
                            عرض الطلب
                          </Link>
                        )}
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {format(new Date(m.created_at), 'HH:mm', { locale: ar })}
                        </span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-sm font-bold tabular-nums shrink-0',
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

export default InventoryMovementsPanel;
