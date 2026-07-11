import { memo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ShoppingBag,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  TrendingUp,
  Eye,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import AttentionAlertLink from '@/components/dashboard/AttentionAlertLink';
import StatCard from '@/components/ui/StatCard';
import { cn } from '@/lib/utils';
import type { DashboardActionItem } from '@/hooks/useDashboardInsights';
import type { Order } from '@/types';

const statusConfig = {
  completed: { label: 'مكتمل', icon: CheckCircle, className: 'bg-success/10 text-success' },
  pending: { label: 'جديد', icon: Clock, className: 'bg-warning/10 text-warning' },
  cancelled: { label: 'ملغي', icon: XCircle, className: 'bg-destructive/10 text-destructive' },
};

interface DashboardAttentionSectionProps {
  actions: DashboardActionItem[];
}

export const DashboardAttentionSection = memo(function DashboardAttentionSection({
  actions,
}: DashboardAttentionSectionProps) {
  if (actions.length === 0) return null;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="ds-section-title">يحتاج انتباهك</h3>
        <span className="text-[11px] font-medium text-destructive/80 bg-destructive/10 px-2 py-0.5 rounded-full tabular-nums">
          {actions.length}
        </span>
      </div>
      <div className="space-y-2.5">
        {actions.map((action) => (
          <AttentionAlertLink
            key={action.id}
            id={action.id}
            title={action.title}
            description={action.description}
            href={action.href}
            icon={action.icon}
          />
        ))}
      </div>
    </div>
  );
});

interface DashboardTodayKpisProps {
  revenue: number;
  visits: number;
}

export const DashboardTodayKpis = memo(function DashboardTodayKpis({
  revenue,
  visits,
}: DashboardTodayKpisProps) {
  return (
    <div>
      <h3 className="ds-section-title mb-4 px-1">ملخص اليوم</h3>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          label="مبيعات اليوم (د.ع)"
          value={revenue.toLocaleString()}
          icon={TrendingUp}
          iconClassName="bg-emerald-500/10 ring-emerald-500/15 [&_svg]:text-emerald-600"
        />
        <StatCard
          label="زوار اليوم"
          value={visits.toLocaleString()}
          icon={Eye}
          iconClassName="bg-violet-500/10 ring-violet-500/15 [&_svg]:text-violet-600"
        />
      </div>
    </div>
  );
});

interface DashboardRecentOrdersSectionProps {
  orders: Order[];
}

export const DashboardRecentOrdersSection = memo(function DashboardRecentOrdersSection({
  orders,
}: DashboardRecentOrdersSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="ds-section-title">الطلبات الجديدة</h3>
        {orders.length > 0 && (
          <Link to="/orders?attention=pending-orders" className="text-xs text-primary hover:text-primary/80 font-medium">
            عرض الكل
          </Link>
        )}
      </div>

      {orders.length > 0 ? (
        <div className="ds-card divide-y divide-border/40 overflow-hidden">
          {orders.map((order) => {
            const config =
              statusConfig[order.status as keyof typeof statusConfig] ?? statusConfig.pending;
            const StatusIcon = config.icon;
            return (
              <Link
                key={order.id}
                to="/orders?attention=pending-orders"
                className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors group"
              >
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-sm font-medium text-foreground truncate">{order.customerInfo.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(order.date), 'yyyy-MM-dd · hh:mm a')}
                  </p>
                </div>
                <p className="text-sm font-bold text-foreground tabular-nums shrink-0">
                  {order.total.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">د.ع</span>
                </p>
                <Badge className={cn('border-0 shrink-0', config.className)}>
                  <StatusIcon className="w-3 h-3 ml-1" />
                  {config.label}
                </Badge>
                <ArrowLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="ds-card p-6 text-center">
          <ShoppingBag className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">لا توجد طلبات جديدة — شارك رابط متجرك مع عملائك</p>
        </div>
      )}
    </div>
  );
});
