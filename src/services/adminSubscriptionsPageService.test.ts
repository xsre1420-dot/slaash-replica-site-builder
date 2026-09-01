import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cache } from '@/lib/cache';
import {
  loadAdminSubscriptionsPageBundle,
  peekAdminSubscriptionsPageBundle,
  invalidateAdminSubscriptionsPageBundle,
} from '@/services/adminSubscriptionsPageService';

vi.mock('@/services/leadAdminService', () => ({
  fetchSubscriptions: vi.fn(async (opts: { status?: string; limit?: number }) => {
    const status = opts.status ?? 'all';
    const totals: Record<string, number> = {
      all: 10,
      active: 6,
      expired: 3,
      suspended: 1,
    };
    const key = status === undefined ? 'all' : status;
    return {
      rows: key === 'all' ? [{ id: 's1', plan_name: 'annual', status: 'active' }] : [],
      total: totals[key] ?? 0,
    };
  }),
}));

describe('adminSubscriptionsPageService', () => {
  beforeEach(() => {
    cache.flushAll();
    vi.clearAllMocks();
  });

  it('loadAdminSubscriptionsPageBundle loads list and stats together', async () => {
    const bundle = await loadAdminSubscriptionsPageBundle({ search: '', status: 'all' });
    expect(bundle.rows).toHaveLength(1);
    expect(bundle.stats.total).toBe(10);
    expect(bundle.stats.active).toBe(6);
    expect(peekAdminSubscriptionsPageBundle('', 'all')?.total).toBe(10);
  });

  it('invalidateAdminSubscriptionsPageBundle clears cache', async () => {
    await loadAdminSubscriptionsPageBundle({ search: '', status: 'all' });
    invalidateAdminSubscriptionsPageBundle();
    expect(peekAdminSubscriptionsPageBundle('', 'all')).toBeNull();
  });
});
