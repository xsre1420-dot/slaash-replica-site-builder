/**
 * Analytics facade — statistics, dashboard KPIs, and storefront tracking.
 */
export {
  fetchStatisticsData,
  getStatisticsDateBounds,
  hasUsableStatisticsKpis,
  hasTopSellingProductsKpi,
  type StatisticsDateBounds,
} from '@/services/statisticsService';

export {
  fetchDashboardStatisticsBatch,
  invalidateDashboardBatchCache,
  type DashboardBatchPayload,
  type DashboardCatalogKpis,
} from '@/services/dashboardStatsService';

export { trackStoreVisitBySlug, trackProductViewBySlug } from '@/services/analyticsTrackingService';

export {
  auditMerchantAnalyticsHealth,
  type AnalyticsHealthResult,
} from '@/services/analyticsHealthService';

export { fetchCustomerMetricsForPeriod, type CustomerPeriodMetrics } from '@/services/customerService';
