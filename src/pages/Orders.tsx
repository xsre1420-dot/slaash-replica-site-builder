import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Package,
  Clock,
  TrendingUp,
  ShoppingBag,
  Bell,
  Loader2,
  Download,
  CalendarDays,
  CalendarRange,
} from 'lucide-react';
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
import OrdersBulkBar from '@/components/orders/OrdersBulkBar';
import OrdersPagination from '@/components/orders/OrdersPagination';
import OrderNotificationsCenter from '@/components/orders/OrderNotificationsCenter';
import {
  OrderListFilters,
  formatOrderNumber,
} from '@/utils/orderWorkflowUtils';
import { exportOrdersToCsv } from '@/utils/orderExportUtils';
import { useOrderDashboardStats } from '@/hooks/useOrderDashboardStats';
import { useOrderNotifications, eventToNotification } from '@/hooks/useOrderNotifications';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ORDERS_PER_PAGE } from '@/services/orderService';
import { toast } from 'sonner';
import { copyStorePublicUrl } from '@/lib/storeUrl';
import { useScrollPersistence } from '@/hooks/useScrollPersistence';
import AttentionStrip from '@/components/ui/AttentionStrip';
import { ATTENTION_PARAM } from '@/lib/attentionHighlight';
import { canTransitionOrderStatus } from '@/utils/orderStatusUtils';

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

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  useScrollPersistence('orders');

  const { stats } = useOrderDashboardStats(statsRefreshKey);

  useEffect(() => {
    if (searchParams.get(ATTENTION_PARAM) !== 'pending-orders' || attentionApplied.current) return;
    attentionApplied.current = true;
    setFilters((prev) => ({
      ...prev,
      workflowTab: stats.newOrders > 0 ? 'new' : 'processing',
    }));
  }, [searchParams, stats.newOrders]);

  const handleRealtimeEvent = useCallback(
    (event: OrderRealtimeEvent) => {
      const notification = eventToNotification(event);
      if (notification) pushNotification(notification);

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
              onClick: () => navigate(`/orders/${event.orderId}`),
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

  useRealtimeOrders(() => {
    refetch();
    setStatsRefreshKey((k) => k + 1);
  }, handleRealtimeEvent);

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

  const handleExport = () => {
    const toExport = selectedIds.size > 0
      ? orders.filter((o) => selectedIds.has(o.id))
      : orders;
    if (toExport.length === 0) {
      toast.error('لا توجد طلبات للتصدير');
      return;
    }
    exportOrdersToCsv(toExport, `orders-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(`تم تصدير ${toExport.length} طلب`);
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
    let ok = 0;
    for (const order of targets) {
      const success = await updateOrderStatus(order.id, status);
      if (success) ok += 1;
    }
    setBulkProcessing(false);
    setSelectedIds(new Set());
    toast.success(`تم تحديث ${ok} من ${targets.length} طلب`);
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

  const headerActions = (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <OrderNotificationsCenter
        notifications={notifications}
        unreadCount={unreadCount}
        onOpen={openOrder}
        onMarkAllRead={markAllRead}
        onClear={clearAll}
      />
      {stats.newOrders > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl gap-2 border-warning/40 text-warning min-h-[40px]"
          onClick={() => updateFilters({ workflowTab: 'new' })}
        >
          <Bell className="w-4 h-4" />
          {stats.newOrders} جديد
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="rounded-xl gap-2 min-h-[40px]"
        onClick={handleExport}
        disabled={orders.length === 0}
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">تصدير</span>
      </Button>
    </div>
  );

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
        actions={headerActions}
      />

      <div className="ds-page space-y-5 sm:space-y-6 pb-24 sm:pb-6 min-w-0">
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <StatCard
            label="إجمالي الطلبات"
            value={stats.total}
            icon={Package}
            onClick={() => updateFilters({ workflowTab: 'all', datePreset: 'all' })}
            active={filters.workflowTab === 'all' && filters.datePreset === 'all'}
          />
          <StatCard
            label="طلبات جديدة"
            value={stats.newOrders}
            icon={Clock}
            iconClassName="bg-warning/10 ring-warning/15 [&_svg]:text-warning"
            onClick={() => updateFilters({ workflowTab: 'new' })}
            active={filters.workflowTab === 'new'}
          />
          <StatCard
            label="بانتظار التنفيذ"
            value={stats.pendingFulfillment}
            icon={ShoppingBag}
            iconClassName="bg-primary/10 ring-primary/15 [&_svg]:text-primary"
            onClick={() => updateFilters({ workflowTab: 'processing' })}
            active={filters.workflowTab === 'processing'}
          />
          <StatCard
            label="إيرادات مكتملة"
            value={`${stats.revenue.toLocaleString()} د.ع`}
            icon={TrendingUp}
            iconClassName="bg-success/10 ring-success/15 [&_svg]:text-success"
            onClick={() => updateFilters({ workflowTab: 'delivered' })}
            active={filters.workflowTab === 'delivered'}
          />
        </section>

        <section className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatCard
            label="طلبات اليوم"
            value={stats.todayOrders}
            icon={CalendarDays}
            iconClassName="bg-blue-500/10 ring-blue-500/15 [&_svg]:text-blue-600"
            onClick={() => updateFilters({ datePreset: 'today', workflowTab: 'all' })}
            active={filters.datePreset === 'today'}
            className="p-3 sm:p-5"
          />
          <StatCard
            label="هذا الأسبوع"
            value={stats.weekOrders}
            icon={CalendarRange}
            iconClassName="bg-violet-500/10 ring-violet-500/15 [&_svg]:text-violet-600"
            onClick={() => updateFilters({ datePreset: 'week', workflowTab: 'all' })}
            active={filters.datePreset === 'week'}
            className="p-3 sm:p-5"
          />
          <StatCard
            label="هذا الشهر"
            value={stats.monthOrders}
            icon={CalendarDays}
            iconClassName="bg-indigo-500/10 ring-indigo-500/15 [&_svg]:text-indigo-600"
            onClick={() => updateFilters({ datePreset: 'month', workflowTab: 'all' })}
            active={filters.datePreset === 'month'}
            className="p-3 sm:p-5"
          />
        </section>

        {stats.pendingFulfillment > 0 && (
          <AttentionStrip
            attentionKey="pending-orders"
            icon={Clock}
            message={`${stats.pendingFulfillment} ${
              stats.pendingFulfillment === 1 ? 'طلب' : 'طلبات'
            } تحتاج المعالجة — راجع الطلبات وحدّث حالتها`}
          />
        )}

        <section className="space-y-3 min-w-0">
          <OrdersWorkflowTabs
            tabCounts={tabCounts}
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
        </section>

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
              onToggleSelectAll={toggleSelectAll}
              allSelected={selectedIds.size === orders.length && orders.length > 0}
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
