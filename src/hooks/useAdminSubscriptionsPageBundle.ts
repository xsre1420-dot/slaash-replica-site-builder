import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadAdminSubscriptionsPageBundle,
  peekAdminSubscriptionsPageBundle,
  invalidateAdminSubscriptionsPageBundle,
  type AdminSubscriptionsPageBundle,
} from '@/services/adminSubscriptionsPageService';
import type { SubscriptionOverviewStats } from '@/components/admin/subscription/SubscriptionOverviewCards';
import type { SubscriptionRecord } from '@/types/leads';

export type AdminSubscriptionsPageState = {
  loading: boolean;
  rows: SubscriptionRecord[];
  total: number;
  stats: SubscriptionOverviewStats;
  refetch: () => Promise<AdminSubscriptionsPageBundle>;
};

const EMPTY_STATS: SubscriptionOverviewStats = {
  total: 0,
  active: 0,
  expired: 0,
  suspended: 0,
};

export function useAdminSubscriptionsPageBundle(
  search: string,
  status: string
): AdminSubscriptionsPageState {
  const [bundle, setBundle] = useState<AdminSubscriptionsPageBundle | null>(() =>
    peekAdminSubscriptionsPageBundle(search, status)
  );
  const [loading, setLoading] = useState(() => !bundle);

  useEffect(() => {
    const cached = peekAdminSubscriptionsPageBundle(search, status);
    if (cached) {
      setBundle(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void loadAdminSubscriptionsPageBundle({ search, status }).then((loaded) => {
      if (cancelled) return;
      setBundle(loaded);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [search, status]);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await loadAdminSubscriptionsPageBundle({ search, status }, { force: true });
      setBundle(loaded);
      return loaded;
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  return useMemo(
    () => ({
      loading,
      rows: bundle?.rows ?? [],
      total: bundle?.total ?? 0,
      stats: bundle?.stats ?? EMPTY_STATS,
      refetch,
    }),
    [loading, bundle, refetch]
  );
}

export { invalidateAdminSubscriptionsPageBundle };
