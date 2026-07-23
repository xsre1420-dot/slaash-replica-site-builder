import { TrendingUp, Clock, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrderDashboardStats } from '@/services/orderService';
import type { OrderListFilters, OrderWorkflowTab } from '@/utils/orderWorkflowUtils';
import type { WorkflowTabCounts } from '@/types/orders';

interface OrdersSummaryStripProps {
  stats: OrderDashboardStats;
  tabCounts: WorkflowTabCounts;
  activeTab: OrderWorkflowTab;
  datePreset: OrderListFilters['datePreset'];
  onFilter: (patch: Partial<OrderListFilters>) => void;
}

const formatIqd = (amount: number) => `${amount.toLocaleString('ar-IQ')} د.ع`;

const OrdersSummaryStrip = ({
  stats,
  tabCounts,
  activeTab,
  datePreset,
  onFilter,
}: OrdersSummaryStripProps) => {
  const chips: {
    tab: OrderWorkflowTab;
    label: string;
    value: string | number;
    emphasis?: boolean;
  }[] = [
    {
      tab: 'all',
      label: 'الكل',
      value: (tabCounts.new ?? 0) + (tabCounts.completed ?? 0) + (tabCounts.cancelled ?? 0) || stats.total,
    },
    { tab: 'new', label: 'جديد', value: tabCounts.new ?? stats.newOrders, emphasis: (tabCounts.new ?? 0) > 0 },
    { tab: 'completed', label: 'مكتمل', value: tabCounts.completed ?? stats.delivered },
    { tab: 'cancelled', label: 'ملغي', value: tabCounts.cancelled ?? 0 },
  ];

  const revenueItems = [
    { label: 'الإجمالي', value: stats.revenue, highlight: true },
    { label: 'الشهر', value: stats.monthRevenue },
    { label: 'الأسبوع', value: stats.weekRevenue },
    { label: 'اليوم', value: stats.todayRevenue },
  ];

  return (
    <div className="space-y-2.5" dir="rtl">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {chips.map((chip) => {
          const isActive = activeTab === chip.tab && datePreset === 'all';
          return (
            <button
              key={chip.tab}
              type="button"
              onClick={() => onFilter({ workflowTab: chip.tab, datePreset: 'all' })}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-3 py-2 shrink-0 border min-h-[44px] transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card text-foreground border-border/60 hover:border-primary/30',
                chip.emphasis && !isActive && 'border-warning/40 bg-warning/5'
              )}
            >
              <span className="text-sm font-semibold whitespace-nowrap">{chip.label}</span>
              <span
                className={cn(
                  'inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-md px-1.5 text-[11px] font-bold tabular-nums',
                  isActive ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
                )}
              >
                {chip.value}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-primary/[0.04] p-3 sm:p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10 ring-1 ring-success/15">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">ملخص الإيرادات</p>
              <p className="text-[11px] text-muted-foreground truncate">من الطلبات المكتملة والمحصّلة</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onFilter({ workflowTab: 'completed', datePreset: 'all' })}
            className={cn(
              'text-[11px] font-medium text-primary hover:underline shrink-0',
              activeTab === 'completed' && 'underline'
            )}
          >
            عرض المكتملة
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {revenueItems.map((item) => (
            <div
              key={item.label}
              className={cn(
                'rounded-xl px-3 py-2.5 border',
                item.highlight
                  ? 'border-success/25 bg-success/[0.06]'
                  : 'border-border/40 bg-background/60'
              )}
            >
              <p className="text-[10px] sm:text-[11px] text-muted-foreground mb-0.5">{item.label}</p>
              <p
                className={cn(
                  'text-sm sm:text-base font-bold tabular-nums leading-tight',
                  item.highlight ? 'text-success' : 'text-foreground'
                )}
              >
                {formatIqd(item.value)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground border-t border-border/40 pt-3">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {stats.delivered} طلب مكتمل
          </span>
          {stats.avgOrderValue > 0 && (
            <span>متوسط الطلب: {formatIqd(stats.avgOrderValue)}</span>
          )}
          {stats.pendingRevenue > 0 && (
            <span className="inline-flex items-center gap-1 text-warning">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {formatIqd(stats.pendingRevenue)} بانتظار التحصيل
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrdersSummaryStrip;
