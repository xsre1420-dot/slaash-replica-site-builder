import { memo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecentOrders } from '@/hooks/useRecentOrders';
import { useDashboardInsights } from '@/hooks/useDashboardInsights';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import {
  DashboardAttentionSection,
  DashboardTodayKpis,
  DashboardRecentOrdersSection,
} from '@/components/dashboard/DashboardOverviewSections';

const DashboardOverview = memo(function DashboardOverview() {
  const { orders, loading, refetch } = useRecentOrders(5);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const { actions, today, loading: insightsLoading } = useDashboardInsights(statsRefreshKey);

  useRealtimeOrders(() => {
    refetch();
    setStatsRefreshKey((k) => k + 1);
  });

  const showSkeleton = loading && orders.length === 0 && insightsLoading;

  if (showSkeleton) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <DashboardAttentionSection actions={actions} />
      <DashboardTodayKpis revenue={today.revenue} visits={today.visits} />
      <DashboardRecentOrdersSection orders={orders} />
    </div>
  );
});

export default DashboardOverview;
