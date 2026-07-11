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
import { Button } from '@/components/ui/button';
import { useOrders } from '@/hooks/useOrders';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeOrders, OrderRealtimeEvent } from '@/hooks/useRealtimeOrders';
import OrdersToolbar, { DEFAULT_ORDER_FILTERS } from '@/components/orders/OrdersToolbar';
import OrdersSummaryStrip from '@/components/orders/OrdersSummaryStrip';
import OrdersDataTable from '@/components/orders/OrdersDataTable';
import OrdersBulkBar from '@/components/orders/OrdersBulkBar';
import OrdersPagination from '@/components/orders/OrdersPagination';
import OrderNotificationsCenter from '@/components/orders/OrderNotificationsCenter';
import { useOrderNotifications, eventToNotification } from '@/hooks/useOrderNotifications';
import {
  OrderListFilters,
  formatOrderNumber,
} from '@/utils/orderWorkflowUtils';
import { useOrderDashboardStats } from '@/hooks/useOrderDashboardStats';
import { isLocalOrderMutationEcho } from '@/lib/localMutationGuard';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ORDERS_PER_PAGE } from '@/services/orderService';
import { toast } from 'sonner';
import { copyStorePublicUrl } from '@/lib/storeUrl';
import { useScrollPersistence } from '@/hooks/useScrollPersistence';
import { ATTENTION_PARAM } from '@/lib/attentionHighlight';
import { canTransitionOrderStatus } from '@/utils/orderStatusUtils';
import { runWithConcurrency } from '@/utils/runWithConcurrency';

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
    page,
    total,
    totalPages,
    tabCounts,
    goToPage,
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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

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

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => orders.some((o) => o.id === id)));
      return next.size === prev.size ? prev : next;
    });
  }, [orders]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [listFilters]);

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

  const toggleSelect = (orderId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  };

  const runBulkStatus = async (status: 'completed' | 'cancelled') => {
    const targets = orders.filter(
      (o) => selectedIds.has(o.id) && canTransitionOrderStatus(o.status, status)
    );
    if (targets.length === 0) {
      toast.error('لا توجد طلبات قابلة للتحديث');
      return;
    }
    if (status === 'cancelled' && !confirm(`إلغاء ${targets.length} طلب؟`)) return;

    setBulkProcessing(true);
    const ok = await runWithConcurrency(targets, 5, (order) =>
      updateOrderStatus(order.id, status)
    );
    setBulkProcessing(false);
    setSelectedIds(new Set());
    toast.success(`تم تحديث ${ok} من ${targets.length} طلب`);
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

      <div className="ds-page space-y-4 pb-24 sm:pb-6 min-w-0">
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
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : orders.length > 0 ? (
          <section className="space-y-3 min-w-0">
            <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground px-1 gap-2">
              <span>{total} طلب</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs rounded-lg"
                onClick={toggleSelectAll}
              >
                {selectedIds.size === orders.length ? 'إلغاء التحديد' : 'تحديد الكل'}
              </Button>
            </div>

            <OrdersDataTable
              orders={orders}
              onUpdateStatus={handleStatusChange}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />

            <OrdersBulkBar
              selectedCount={selectedIds.size}
              totalVisible={orders.length}
              onSelectAll={toggleSelectAll}
              onClearSelection={() => setSelectedIds(new Set())}
              onBulkComplete={() => void runBulkStatus('completed')}
              onBulkCancel={() => void runBulkStatus('cancelled')}
              processing={bulkProcessing}
            />

            <OrdersPagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={ORDERS_PER_PAGE}
              loading={loading}
              onPageChange={goToPage}
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
