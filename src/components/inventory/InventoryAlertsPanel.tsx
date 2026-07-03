import { AlertTriangle, ChevronDown, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  alertUrgencyClasses,
  type InventoryAlert,
  type InventoryAlertUrgency,
} from '@/utils/inventoryPageUtils';
import { useState } from 'react';

const urgencyLabel: Record<InventoryAlertUrgency, string> = {
  critical: 'حرج',
  high: 'عالي',
  medium: 'متوسط',
  low: 'منخفض',
};

interface InventoryAlertsPanelProps {
  alerts: InventoryAlert[];
  onAlertAction?: (alert: InventoryAlert) => void;
  integrityScore?: number | null;
}

const InventoryAlertsPanel = ({
  alerts,
  onAlertAction,
  integrityScore,
}: InventoryAlertsPanelProps) => {
  const [expanded, setExpanded] = useState(true);

  if (alerts.length === 0 && integrityScore == null) return null;

  return (
    <section className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors text-right"
      >
        <ChevronDown
          className={cn('w-4 h-4 text-muted-foreground transition-transform', expanded && 'rotate-180')}
        />
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/15">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground">مركز التنبيهات</p>
            <p className="text-xs text-muted-foreground truncate">
              {alerts.length} تنبيه نشط
              {integrityScore != null ? ` · سلامة ${integrityScore}%` : ''}
            </p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-border/40 pt-3">
          {integrityScore != null && integrityScore < 100 && (
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-right">
              <ShieldAlert className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs text-foreground flex-1">
                سلامة سجل المخزون: <span className="font-bold tabular-nums">{integrityScore}%</span>
              </p>
            </div>
          )}
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-right',
                alertUrgencyClasses(alert.urgency)
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 justify-end mb-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {urgencyLabel[alert.urgency]}
                  </span>
                  <p className="font-semibold text-sm text-foreground">{alert.title}</p>
                </div>
                <p className="text-xs text-muted-foreground">{alert.description}</p>
              </div>
              {alert.actionLabel && onAlertAction && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl h-8 text-xs shrink-0"
                  onClick={() => onAlertAction(alert)}
                >
                  {alert.actionLabel}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default InventoryAlertsPanel;
