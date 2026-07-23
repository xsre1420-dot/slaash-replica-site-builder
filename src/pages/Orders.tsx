import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShoppingBag,
  Loader2,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrders } from '@/hooks/useOrders';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeOrders, OrderRealtimeEvent } from '@/hooks/useRealtimeOrders';
import OrdersToolbar, { DEFAULT_ORDER_FILTERS } from '@/components/orders/OrdersToolbar';
import OrdersSummaryStrip from '@/components/orders/OrdersSummaryStrip';
import OrdersDataTable from '@/components/orders/OrdersDataTable';
import OrderNotificationsCenter from '@/components/orders/OrderNotificationsCenter';
import { useOrderNotifications, eventToNotification } from '@/hooks/useOrderNotifications';
import {
  OrderListFilters,
  formatOrderNumber,
} from '@/utils/orderWorkflowUtils';
import { useOrderDashboardStats } from '@/hooks/useOrderDashboardStats';
import { isLocalOrderMutationEcho } from '@/lib/localMutationGuard';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { toast } from 'sonner';
import { copyStorePublicUrl, getStoreLinkShareHint } from '@/lib/storeUrl';
import { useScrollPersistence } from '@/hooks/useScrollPersistence';
import { ATTENTION_PARAM } from '@/lib/attentionHighlight';

const Orders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const attentionApplied = useRef(false);

  const [filters, setFilters] = useState<OrderListFilters>(DEFAULT_ORDER_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search, 350);
  const listFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch]
  );

  const {
    orders,
    updateOrderStatus,
    loading,
    total,
    tabCounts,
    refetch,
    isNewOrder,
    markOrderKnown,
  } = useOrders(listFilters);

  const {
    notifications,
    unreadCount,
    pushNotification,
    markAllRead,
    clearAll,
    openOrder,
  } = useOrderNotifications(user?.id);

  useScrollPersistence('orders');

  const { stats, reloadStats } = useOrderDashboardStats();

  useEffect(() => {
    if (searchParams.get(ATTENTION_PARAM) !== 'pending-orders' || attentionApplied.current) return;
    attentionApplied.current = true;
    setFilters((prev) => ({
      ...prev,
      workflowTab: 'new',
    }));
  }, [searchParams, stats.newOrders]);

  const handleRealtimeEvent = useCallback(
    (event: OrderRealtimeEvent) => {
      if ('orderId' in event && isLocalOrderMutationEcho(event.orderId)) {
        return;
      }

      const notification = eventToNotification(event);
      if (notification) pushNotification(notification);

      if (event.type === 'insert' && isNewOrder(event.orderId)) {
        markOrderKnown(event.orderId);
        toast.success('طلب جديد!', {
          description: `تم استلام ${formatOrderNumber(event.orderId)}`,
          duration: 8000,
          action: {
            label: 'عرض',
            onClick: () => navigate('/orders'),
          },
        });
      } else if (event.type === 'update') {
        if (event.status === 'completed') {
          toast.success('تم إكمال طلب', {
            description: formatOrderNumber(event.orderId),
            duration: 4000,
          });
        } else if (event.status === 'cancelled') {
          toast.warning('تم إلغاء طلب', {
            description: formatOrderNumber(event.orderId),
            duration: 5000,
            action: {
              label: 'عرض',
              onClick: () => navigate('/orders'),
            },
          });
        } else if (event.paymentStatus === 'paid' || event.paymentStatus === 'collected') {
          toast.success('تم استلام الدفع', {
            description: formatOrderNumber(event.orderId),
            duration: 5000,
          });
        } else if (
          event.paymentStatus === 'refunded' ||
          event.paymentStatus === 'partially_refunded'
        ) {
          toast.info('تحديث الدفع', {
            description: `${formatOrderNumber(event.orderId)} — ${event.paymentStatus === 'refunded' ? 'مسترد' : 'مسترد جزئياً'}`,
            duration: 5000,
          });
        } else if (event.paymentStatus === 'failed') {
          toast.error('فشل الدفع', {
            description: formatOrderNumber(event.orderId),
            duration: 6000,
          });
        }
      }
    },
    [isNewOrder, markOrderKnown, navigate, pushNotification]
  );

  useRealtimeOrders(
    () => {
      refetch();
      void reloadStats();
    },
    handleRealtimeEvent
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
    return success;
  };

  const handleCopyStoreLink = async () => {
    if (!user?.id) return;
    try {
      const url = await copyStorePublicUrl(user.id, {
        username: user.username,
        storeName: user.store_name,
      });
      if (!url) {
        toast.error('حدّد رابط المتجر (slug) من الإعدادات أولاً');
        return;
      }
      const hint = getStoreLinkShareHint(url);
      toast.success('تم نسخ رابط المتجر', hint ? { description: hint, duration: 5000 } : undefined);
    } catch {
      toast.error('فشل في نسخ الرابط');
    }
  };

  const hasActiveFilters =
    filters.search ||
    filters.workflowTab !== DEFAULT_ORDER_FILTERS.workflowTab ||
    filters.datePreset !== 'all';

  const headerActions = (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <OrderNotificationsCenter
        notifications={notifications}
        unreadCount={unreadCount}
        newOrdersCount={tabCounts.new ?? stats.newOrders}
        onOpen={openOrder}
        onMarkAllRead={markAllRead}
        onClear={clearAll}
      />
    </div>
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="الطلبات"
        description="راجع الطلبات الجديدة وحدّث حالتها"
        hideBack
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/builder' },
          { label: 'الطلبات' },
        ]}
        actions={headerActions}
      />

      <div className="ds-page space-y-3 pb-6 min-w-0">
        <OrdersSummaryStrip
          stats={stats}
          tabCounts={tabCounts}
          activeTab={filters.workflowTab}
          datePreset={filters.datePreset}
          onFilter={updateFilters}
        />

        <OrdersToolbar
          filters={filters}
          onChange={updateFilters}
          onClear={clearFilters}
        />

        {loading && orders.length === 0 ? (
          <div className="rounded-2xl border border-border/60 overflow-hidden bg-card min-w-0">
            <div className="space-y-0">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 rounded-none border-b border-border/30" />
              ))}
            </div>
          </div>
        ) : orders.length > 0 ? (
          <section className="space-y-3 min-w-0">
            <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground px-1 gap-2">
              <span>{total} طلب</span>
            </div>

            <OrdersDataTable
              orders={orders}
              onUpdateStatus={handleStatusChange}
            />

            {loading && (
              <div className="flex justify-center py-2">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </section>
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
