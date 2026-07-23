import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Package,
  PackagePlus,
  Settings,
  Archive,
  MessageSquare,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { buildAttentionHref, type AttentionKey } from '@/lib/attentionHighlight';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
import { hasConfiguredDeliveryPrices } from '@/utils/deliveryUtils';
import { getProductsSync } from '@/services/productService';
import { countPendingReviewsForOwner } from '@/services/reviewService';
import { getStorePublicSlug } from '@/lib/storeUrl';
import {
  computePeriodMetricsFromOrders,
  countDraftProducts,
  countLowStockProducts,
  EMPTY_PERIOD,
  getPreviousWeekBoundsIso,
  getTodayBoundsIso,
  getWeekBoundsIso,
  getYesterdayBoundsIso,
  summarizeInventoryAlerts,
  type PeriodMetrics,
} from '@/utils/dashboardInsightsUtils';
import { getProductLifecycleStatus } from '@/lib/productLifecycle';
import {
  buildOrderDashboardStatsFromBatch,
  fetchDashboardStatisticsBatch,
  fetchStoreStatisticsPeriod,
} from '@/services/dashboardStatsService';
import { fetchOrderStatsRows } from '@/services/orderService';
import type { Order } from '@/types';
import { useIsMounted } from '@/hooks/useIsMounted';

export type DashboardActionItem = {
  id: AttentionKey;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

export type DashboardInsights = {
  actions: DashboardActionItem[];
  today: PeriodMetrics;
  yesterday: PeriodMetrics;
  week: PeriodMetrics;
  previousWeek: PeriodMetrics;
  lowStockCount: number;
  inventoryOutCount: number;
  pendingOrdersCount: number;
  pendingReviewsCount: number;
  loading: boolean;
};

const fetchRpcPeriod = (
  ownerId: string,
  start: string,
  end: string
): Promise<PeriodMetrics | null> => fetchStoreStatisticsPeriod(ownerId, start, end);

export const useDashboardInsights = (refreshKey = 0): DashboardInsights => {
  const { user } = useAuth();
  const { storeSettings } = useStore();
  const mountedRef = useIsMounted();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingFulfillment, setPendingFulfillment] = useState(0);

  const [periods, setPeriods] = useState({
    today: EMPTY_PERIOD,
    yesterday: EMPTY_PERIOD,
    week: EMPTY_PERIOD,
    previousWeek: EMPTY_PERIOD,
  });
  const [hasSlug, setHasSlug] = useState<boolean | null>(null);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
  const [catalogKpis, setCatalogKpis] = useState<{
    productCount: number;
    publishedCount: number;
    lowStockCount: number;
  } | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setHasSlug(null);
      return;
    }
    let cancelled = false;
    void getStorePublicSlug(user.id).then((slug) => {
      if (!cancelled) setHasSlug(!!slug);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setPendingReviewsCount(0);
      return;
    }
    let cancelled = false;
    void countPendingReviewsForOwner(user.id).then((count) => {
      if (!cancelled) setPendingReviewsCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, refreshKey]);

  const loadPeriods = useCallback(async () => {
    if (!user?.id) {
      setOrders([]);
      setPeriods({
        today: EMPTY_PERIOD,
        yesterday: EMPTY_PERIOD,
        week: EMPTY_PERIOD,
        previousWeek: EMPTY_PERIOD,
      });
      setCatalogKpis(null);
      setKpiLoading(false);
      return;
    }

    setKpiLoading(true);

    const batch = await fetchDashboardStatisticsBatch(user.id);
    if (!mountedRef.current) return;

    if (
      batch?.today != null &&
      batch.yesterday != null &&
      batch.week != null &&
      batch.previousWeek != null
    ) {
      setOrders([]);
      setPeriods({
        today: batch.today,
        yesterday: batch.yesterday,
        week: batch.week,
        previousWeek: batch.previousWeek,
      });
      setPendingFulfillment(buildOrderDashboardStatsFromBatch(batch).pendingFulfillment);
      setCatalogKpis(batch.catalogKpis);
      setKpiLoading(false);
      return;
    }

    const todayBounds = getTodayBoundsIso();
    const yesterdayBounds = getYesterdayBoundsIso();
    const weekBounds = getWeekBoundsIso();
    const prevWeekBounds = getPreviousWeekBoundsIso();

    const [todayRpc, yesterdayRpc, weekRpc, prevWeekRpc] = await Promise.all([
      fetchRpcPeriod(user.id, todayBounds.start, todayBounds.end),
      fetchRpcPeriod(user.id, yesterdayBounds.start, yesterdayBounds.end),
      fetchRpcPeriod(user.id, weekBounds.start, weekBounds.end),
      fetchRpcPeriod(user.id, prevWeekBounds.start, prevWeekBounds.end),
    ]);
    if (!mountedRef.current) return;

    const rpcComplete =
      todayRpc != null &&
      yesterdayRpc != null &&
      weekRpc != null &&
      prevWeekRpc != null;

    if (rpcComplete) {
      setOrders([]);
      setPeriods({
        today: todayRpc,
        yesterday: yesterdayRpc,
        week: weekRpc,
        previousWeek: prevWeekRpc,
      });
      setKpiLoading(false);
      return;
    }

    const fallbackOrders = await fetchOrderStatsRows(user.id);
    if (!mountedRef.current) return;
    setOrders(fallbackOrders);

    setPeriods({
      today: todayRpc ?? computePeriodMetricsFromOrders(fallbackOrders, { today: true }),
      yesterday: yesterdayRpc ?? computePeriodMetricsFromOrders(fallbackOrders, { yesterday: true }),
      week: weekRpc ?? computePeriodMetricsFromOrders(fallbackOrders, { thisWeek: true }),
      previousWeek:
        prevWeekRpc ?? computePeriodMetricsFromOrders(fallbackOrders, { previousWeek: true }),
    });
    setKpiLoading(false);
  }, [user?.id, mountedRef]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await loadPeriods();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [loadPeriods, refreshKey]);

  const localProducts = useMemo(
    () => getProductsSync(),
    [refreshKey, user?.id, catalogKpis]
  );

  const localNonArchivedCount = useMemo(
    () =>
      localProducts.filter((product) => getProductLifecycleStatus(product) !== 'archived').length,
    [localProducts]
  );

  const catalogTotalCount = Math.max(
    catalogKpis?.productCount ?? 0,
    localNonArchivedCount
  );
  const draftCount = Math.max(
    countDraftProducts(localProducts),
    Math.max(0, catalogTotalCount - (catalogKpis?.publishedCount ?? catalogTotalCount))
  );
  const lowStockCount =
    catalogKpis?.lowStockCount ?? countLowStockProducts(localProducts);
  const inventorySummary = catalogKpis
    ? { low: catalogKpis.lowStockCount, out: 0 }
    : summarizeInventoryAlerts(localProducts);

  const deliveryConfigured = hasConfiguredDeliveryPrices(storeSettings.deliveryPrices);

  const actions = useMemo((): DashboardActionItem[] => {
    const items: DashboardActionItem[] = [];
    const pendingOrdersCount = pendingFulfillment;

    if (!deliveryConfigured) {
      items.push({
        id: 'missing-delivery-prices',
        title: 'أسعار التوصيل غير مُعدّة',
        description: 'حدّد أسعار التوصيل للمحافظات حتى تتمكن من إضافة المنتجات واستقبال الطلبات',
        href: buildAttentionHref('/settings', 'missing-delivery-prices'),
        icon: Truck,
      });
    }

    if (pendingOrdersCount > 0) {
      items.push({
        id: 'pending-orders',
        title: `${pendingOrdersCount} ${pendingOrdersCount === 1 ? 'طلب' : 'طلبات'} تحتاج المعالجة`,
        description: 'راجع الطلبات وحدّث حالتها',
        href: buildAttentionHref('/orders', 'pending-orders'),
        icon: Clock,
      });
    }

    if (pendingReviewsCount > 0) {
      items.push({
        id: 'pending-reviews',
        title: `${pendingReviewsCount} ${pendingReviewsCount === 1 ? 'تقييم' : 'تقييمات'} بانتظار المعالجة`,
        description: 'راجع التعليقات ووافق على ما يناسب متجرك',
        href: buildAttentionHref('/products', 'pending-reviews'),
        icon: MessageSquare,
      });
    }

    if (lowStockCount > 0) {
      const stockDetail =
        inventorySummary.out > 0
          ? `${inventorySummary.out} نفد · ${inventorySummary.low} منخفض`
          : `${lowStockCount} ${lowStockCount === 1 ? 'منتج' : 'منتجات'} تحتاج تعبئة`;
      items.push({
        id: 'low-stock',
        title: 'مخزون منخفض',
        description: stockDetail,
        href: buildAttentionHref('/products', 'low-stock'),
        icon: Archive,
      });
    }

    if (catalogTotalCount === 0 && deliveryConfigured) {
      items.push({
        id: 'empty-catalog',
        title: 'متجرك بدون منتجات',
        description: 'أضف منتجاً واحداً على الأقل لبدء البيع',
        href: buildAttentionHref('/add-product', 'empty-catalog'),
        icon: PackagePlus,
      });
    }

    if (hasSlug === false) {
      items.push({
        id: 'missing-slug',
        title: 'رابط المتجر غير مُعدّ',
        description: 'حدّد slug المتجر حتى يصل العملاء لصفحتك',
        href: buildAttentionHref('/settings', 'missing-slug'),
        icon: Settings,
      });
    }

    if (draftCount > 0) {
      items.push({
        id: 'draft-products',
        title: `${draftCount} ${draftCount === 1 ? 'مسودة' : 'مسودات'} غير منشورة`,
        description: 'انشر المنتجات لتظهر في المتجر',
        href: buildAttentionHref('/products', 'draft-products'),
        icon: Package,
      });
    }

    return items;
  }, [
    pendingFulfillment,
    catalogTotalCount,
    hasSlug,
    lowStockCount,
    inventorySummary.low,
    inventorySummary.out,
    draftCount,
    pendingReviewsCount,
    deliveryConfigured,
  ]);

  return {
    actions,
    today: periods.today,
    yesterday: periods.yesterday,
    week: periods.week,
    previousWeek: periods.previousWeek,
    lowStockCount,
    inventoryOutCount: inventorySummary.out,
    pendingOrdersCount: pendingFulfillment,
    pendingReviewsCount,
    loading: kpiLoading,
  };
};
