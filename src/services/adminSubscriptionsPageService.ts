/**
 * Admin subscriptions page bundle — list + overview stats in one coordinated load.
 */
import { cache, CacheKeys, CacheTTL, dedup, clearInflight } from '@/lib/cache';
import { fetchSubscriptions } from '@/services/leadAdminService';
import type { SubscriptionRecord } from '@/types/leads';
import type { SubscriptionOverviewStats } from '@/components/admin/subscription/SubscriptionOverviewCards';

export type AdminSubscriptionsPageBundle = {
  rows: SubscriptionRecord[];
  total: number;
  stats: SubscriptionOverviewStats;
};

function filterKey(search: string, status: string): string {
  return `${search.trim().toLowerCase()}|${status}`;
}

export function peekAdminSubscriptionsPageBundle(
  search: string,
  status: string
): AdminSubscriptionsPageBundle | null {
  return cache.get<AdminSubscriptionsPageBundle>(
    CacheKeys.adminSubscriptionsPage(filterKey(search, status))
  );
}

export function peekAdminSubscriptionsStats(): SubscriptionOverviewStats | null {
  return cache.get<SubscriptionOverviewStats>(CacheKeys.adminSubscriptionsStats());
}

export function invalidateAdminSubscriptionsPageBundle(): void {
  cache.flushByPrefix('admin-subscriptions-page:');
  cache.del(CacheKeys.adminSubscriptionsStats());
  clearInflight(CacheKeys.adminSubscriptionsStats());
}

async function loadAdminSubscriptionsStats(): Promise<SubscriptionOverviewStats> {
  const key = CacheKeys.adminSubscriptionsStats();
  const peek = peekAdminSubscriptionsStats();
  if (peek) return peek;

  return dedup(key, async () => {
    const [all, active, expired, suspended] = await Promise.all([
      fetchSubscriptions({ limit: 1 }),
      fetchSubscriptions({ status: 'active', limit: 1 }),
      fetchSubscriptions({ status: 'expired', limit: 1 }),
      fetchSubscriptions({ status: 'suspended', limit: 1 }),
    ]);

    const stats: SubscriptionOverviewStats = {
      total: all.total,
      active: active.total,
      expired: expired.total,
      suspended: suspended.total,
    };
    cache.set(key, stats, CacheTTL.MEDIUM, CacheTTL.STALE);
    return stats;
  });
}

/** Single deduped entry for /admin/subscriptions initial data. */
export async function loadAdminSubscriptionsPageBundle(
  filters: { search: string; status: string },
  options?: { force?: boolean }
): Promise<AdminSubscriptionsPageBundle> {
  const key = CacheKeys.adminSubscriptionsPage(filterKey(filters.search, filters.status));

  if (!options?.force) {
    const peek = peekAdminSubscriptionsPageBundle(filters.search, filters.status);
    if (peek) return peek;
  } else {
    cache.del(key);
    clearInflight(key);
    invalidateAdminSubscriptionsStats();
  }

  return dedup(key, async () => {
    const [list, stats] = await Promise.all([
      fetchSubscriptions({
        search: filters.search.trim() || undefined,
        status: filters.status === 'all' ? undefined : filters.status,
      }),
      loadAdminSubscriptionsStats(),
    ]);

    const bundle: AdminSubscriptionsPageBundle = {
      rows: list.rows as SubscriptionRecord[],
      total: list.total,
      stats,
    };
    cache.set(key, bundle, CacheTTL.SHORT, CacheTTL.STALE);
    return bundle;
  });
}
