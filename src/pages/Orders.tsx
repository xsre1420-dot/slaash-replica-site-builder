import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Clock, TrendingUp, ShoppingBag, Bell, Loader2 } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useOrders } from '@/hooks/useOrders';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeOrders, OrderRealtimeEvent } from '@/hooks/useRealtimeOrders';
import OrdersToolbar, { DEFAULT_ORDER_FILTERS } from '@/components/orders/OrdersToolbar';
import OrdersWorkflowTabs from '@/components/orders/OrdersWorkflowTabs';
import OrdersDataTable from '@/components/orders/OrdersDataTable';
import {
  OrderListFilters,
  filterOrdersList,
  formatOrderNumber,
} from '@/utils/orderWorkflowUtils';
import { useOrderDashboardStats } from '@/hooks/useOrderDashboardStats';
import { toast } from 'sonner';
import { copyStorePublicUrl } from '@/lib/storeUrl';
import { useScrollPersistence } from '@/hooks/useScrollPersistence';

const Orders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    orders,
    updateOrderStatus,
    loading,
    hasMore,
    loadMore,
    refetch,
    isNewOrder,
    markOrderKnown,
  } = useOrders();

  const [filters, setFilters] = useState<OrderListFilters>(DEFAULT_ORDER_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);

  useScrollPersistence('orders');

  const { stats } = useOrderDashboardStats(statsRefreshKey);

  const handleRealtimeEvent = useCallback(
    (event: OrderRealtimeEvent) => {
      if (event.type === 'insert' && isNewOrder(event.orderId)) {
        markOrderKnown(event.orderId);
        toast.success('طلب جديد!', {
          description: `تم استلام ${formatOrderNumber(event.orderId)}`,
          duration: 8000,
          action: {
            label: 'عرض',
            onClick: () => navigate(`/orders/${event.orderId}`),
          },
        });
      } else if (event.type === 'update') {
        if (event.status === 'cancelled') {
          toast.warning('تم إلغاء طلب', {
            description: formatOrderNumber(event.orderId),
            duration: 5000,
            action: {
              label: 'عرض',
              onClick: () => navigate(`/orders/${event.orderId}`),
            },
          });
        } else if (
          event.paymentStatus === 'refunded' ||
          event.paymentStatus === 'partially_refunded'
        ) {
          toast.info('تحديث الدفع', {
            description: `${formatOrderNumber(event.orderId)} — ${event.paymentStatus === 'refunded' ? 'مسترد' : 'مسترد جزئياً'}`,
            duration: 5000,
          });
        }
      }
    },
    [isNewOrder, markOrderKnown, navigate]
  );

  useRealtimeOrders(() => {
    refetch();
    setStatsRefreshKey((k) => k + 1);
  }, handleRealtimeEvent);

  const tabCountBase = useMemo(
    () => filterOrdersList(orders, { ...filters, workflowTab: 'all' }),
    [orders, filters]
  );

  const filteredOrders = useMemo(
    () => filterOrdersList(orders, filters),
    [orders, filters]
  );

  const updateFilters = (patch: Partial<OrderListFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const clearFilters = () => setFilters(DEFAULT_ORDER_FILTERS);

  const handleStatusChange = async (orderId: string, newStatus: 'pending' | 'completed' | 'cancelled') => {
    const success = await updateOrderStatus(orderId, newStatus);
    if (success) {
      const messages = {
        completed: 'تم تأكيد الطلب',
        pending: 'تم إرجاع الطلب إلى قيد الانتظار',
        cancelled: 'تم إلغاء الطلب',
      };
      toast.success(messages[newStatus]);
    }
  };

  const handleCopyStoreLink = async () => {
    if (!user?.id) return;
    try {
      const url = await copyStorePublicUrl(user.id);
      if (!url) {
        toast.error('حدّد رابط المتجر (slug) من الإعدادات أولاً');
        return;
      }
      toast.success('تم نسخ رابط المتجر');
    } catch {
      toast.error('فشل في نسخ الرابط');
    }
  };

  const hasActiveFilters =
    filters.search ||
    filters.workflowTab !== 'all' ||
    filters.orderStatus !== 'all' ||
    filters.paymentStatus !== 'all' ||
    filters.deliveryStatus !== 'all' ||
    filters.datePreset !== 'all' ||
    filters.minValue != null ||
    filters.maxValue != null;

  return (
    <DashboardLayout>
      <PageHeader
        title="إدارة الطلبات"
        description="تابع الطلبات، حدّث الحالات، وعالج الشحن والدفع بسرعة"
        hideBack
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/builder' },
          { label: 'الطلبات' },
        ]}
        actions={
          stats.newOrders > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2 border-warning/40 text-warning"
              onClick={() => updateFilters({ workflowTab: 'new' })}
            >
              <Bell className="w-4 h-4" />
              {stats.newOrders} جديد
            </Button>
          ) : undefined
        }
      />

      <div className="ds-page space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="إجمالي الطلبات" value={stats.total} icon={Package} />
          <StatCard
            label="طلبات جديدة"
            value={stats.newOrders}
            icon={Clock}
            iconClassName="bg-warning/10 [&_svg]:text-warning"
          />
          <StatCard
            label="بانتظار التنفيذ"
            value={stats.pendingFulfillment}
            icon={ShoppingBag}
            iconClassName="bg-primary/10 [&_svg]:text-primary"
          />
          <StatCard
            label="إيرادات مكتملة"
            value={`${stats.revenue.toLocaleString()} د.ع`}
            icon={TrendingUp}
            iconClassName="bg-success/10 [&_svg]:text-success"
          />
        </div>

        <OrdersWorkflowTabs
          orders={tabCountBase}
          activeTab={filters.workflowTab}
          onTabChange={(tab) => updateFilters({ workflowTab: tab })}
        />

        <OrdersToolbar
          filters={filters}
          onChange={updateFilters}
          onClear={clearFilters}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
        />

        {loading && orders.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : filteredOrders.length > 0 ? (
          <>
            <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
              <span>{filteredOrders.length} طلب</span>
              {hasMore && (
                <span className="text-xs">يعرض الطلبات المحمّلة — استخدم «تحميل المزيد»</span>
              )}
            </div>

            <OrdersDataTable orders={filteredOrders} onUpdateStatus={handleStatusChange} />

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loading}
                  className="rounded-xl min-w-[160px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      جارٍ التحميل...
                    </>
                  ) : (
                    'تحميل المزيد'
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={ShoppingBag}
            title={hasActiveFilters ? 'لا توجد نتائج' : 'لا توجد طلبات بعد'}
            description={
              hasActiveFilters
                ? 'جرّب تغيير الفلاتر أو مسحها للعثور على طلبات'
                : 'شارك رابط متجرك مع عملائك للحصول على أول طلب'
            }
            actionLabel={hasActiveFilters ? 'مسح الفلاتر' : 'نسخ رابط المتجر'}
            onAction={hasActiveFilters ? clearFilters : handleCopyStoreLink}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Orders;
