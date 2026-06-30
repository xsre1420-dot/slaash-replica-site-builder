/**
 * Dashboard cache layer — enterprise fetch wrappers for statistics surfaces.
 */
import { CacheKeys } from '@/lib/cache';
import { cachedFetchNullable } from '@/lib/cache/enterpriseCache';
import type { WorkflowTabCounts } from '@/types/orders';
import type { DashboardBatchPayload } from '@/services/dashboardStatsService';

export async function fetchDashboardBatchCached(
  ownerId: string,
  fetchFn: () => Promise<DashboardBatchPayload | null>
): Promise<DashboardBatchPayload | null> {
  return cachedFetchNullable({
    key: CacheKeys.dashboardBatch(ownerId),
    domain: 'dashboard',
    ttlPolicyPath: 'medium.dashboard_batch',
    fetchFn,
  });
}

export async function fetchDashboardKpisLightCached(
  ownerId: string,
  fetchFn: () => Promise<Record<string, unknown> | null>
): Promise<Record<string, unknown> | null> {
  return cachedFetchNullable({
    key: CacheKeys.dashboardKpisLight(ownerId),
    domain: 'dashboard',
    ttlPolicyPath: 'medium.dashboard_kpis',
    fetchFn,
  });
}

export async function fetchDashboardWorkflowCountsCached(
  ownerId: string,
  fetchFn: () => Promise<WorkflowTabCounts | null>
): Promise<WorkflowTabCounts | null> {
  return cachedFetchNullable({
    key: CacheKeys.dashboardWorkflowCounts(ownerId),
    domain: 'dashboard',
    ttlPolicyPath: 'short.default',
    fetchFn,
  });
}

export { invalidateDashboardCaches } from '@/lib/cache/cacheInvalidation';
