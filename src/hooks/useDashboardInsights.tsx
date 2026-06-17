import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Package,
  PackagePlus,
  Settings,
  Archive,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import { buildAttentionHref, type AttentionKey } from '@/lib/attentionHighlight';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getProductsSync, loadProducts } from '@/services/productService';
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
  parseRpcPeriodMetrics,
  summarizeInventoryAlerts,
  type PeriodMetrics,
} from '@/utils/dashboardInsightsUtils';
import { useOrders } from '@/hooks/useOrders';
import { useOrderDashboardStats } from '@/hooks/useOrderDashboardStats';

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

const fetchRpcPeriod = async (
  ownerId: string,
  start: string,
  end: string
): Promise<PeriodMetrics | null> => {
  try {
    const { data, error } = await (supabase as any).rpc('get_store_statistics', {
      p_owner_id: ownerId,
      p_start: start,
      p_end: end,
    });
    if (error || !data) return null;
    return parseRpcPeriodMetrics(data as Record<string, unknown>);
  } catch {
    return null;
  }
};

export const useDashboardInsights = (refreshKey = 0): DashboardInsights => {
  const { user } = useAuth();
  const { orders, loading: ordersLoading } = useOrders();
  const { stats } = useOrderDashboardStats(refreshKey);

  const [periods, setPeriods] = useState({
    today: EMPTY_PERIOD,
    yesterday: EMPTY_PERIOD,
    week: EMPTY_PERIOD,
    previousWeek: EMPTY_PERIOD,
  });
  const [hasSlug, setHasSlug] = useState<boolean | null>(null);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
  const [kpiLoading, setKpiLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    void loadProducts(true);
  }, [user?.id, refreshKey]);

  useEffect(() => {
    if (!user?.id) {
      setHasSlug(null);
      setPendingReviewsCount(0);
      return;
    }
    void getStorePublicSlug(user.id).then((slug) => setHasSlug(!!slug));
    void countPendingReviewsForOwner(user.id).then(setPendingReviewsCount);
  }, [user?.id, refreshKey]);

  const loadPeriods = useCallback(async () => {
    if (!user?.id) {
      setPeriods({
        today: EMPTY_PERIOD,
        yesterday: EMPTY_PERIOD,
        week: EMPTY_PERIOD,
        previousWeek: EMPTY_PERIOD,
      });
      setKpiLoading(false);
      return;
    }

    setKpiLoading(true);

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

    const fallbackToday = computePeriodMetricsFromOrders(orders, { today: true });
    const fallbackYesterday = computePeriodMetricsFromOrders(orders, { yesterday: true });
    const fallbackWeek = computePeriodMetricsFromOrders(orders, { thisWeek: true });
    const fallbackPrevWeek = computePeriodMetricsFromOrders(orders, { previousWeek: true });

    setPeriods({
      today: todayRpc ?? fallbackToday,
      yesterday: yesterdayRpc ?? fallbackYesterday,
      week: weekRpc ?? fallbackWeek,
      previousWeek: prevWeekRpc ?? fallbackPrevWeek,
    });
    setKpiLoading(false);
  }, [user?.id, orders]);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods, refreshKey]);

  const products = getProductsSync();
  const productCount = products.length;
  const lowStockCount = countLowStockProducts(products);
  const inventorySummary = summarizeInventoryAlerts(products);
  const draftCount = countDraftProducts(products);

  const actions = useMemo((): DashboardActionItem[] => {
    const items: DashboardActionItem[] = [];
    const pendingOrdersCount = stats.pendingFulfillment;

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
        href: buildAttentionHref('/inventory', 'low-stock'),
        icon: Archive,
      });
    }

    if (productCount === 0) {
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
    stats.pendingFulfillment,
    productCount,
    hasSlug,
    lowStockCount,
    inventorySummary.low,
    inventorySummary.out,
    draftCount,
    pendingReviewsCount,
  ]);

  return {
    actions,
    today: periods.today,
    yesterday: periods.yesterday,
    week: periods.week,
    previousWeek: periods.previousWeek,
    lowStockCount,
    inventoryOutCount: inventorySummary.out,
    pendingOrdersCount: stats.pendingFulfillment,
    pendingReviewsCount,
    loading: ordersLoading || kpiLoading,
  };
};
