import { callReadRpc } from '@/lib/readWrite/readClient';
import { assertMerchantOwner } from '@/lib/tenantGuard';

export type AnalyticsHealthResult = {
  score: number;
  pendingBufferedEvents: number;
  todayVisitsRaw: number;
  todayVisitsRollup: number;
  rollupLag: number;
  recommendation: string;
};

export const auditMerchantAnalyticsHealth = async (
  ownerId: string
): Promise<AnalyticsHealthResult | null> => {
  await assertMerchantOwner(ownerId);

  const { data, error } = await callReadRpc<Record<string, unknown>>('audit_merchant_analytics_health', {
    p_owner_id: ownerId,
  });

  const payload = data as {
    success?: boolean;
    score?: number;
    pending_buffered_events?: number;
    today_visits_raw?: number;
    today_visits_rollup?: number;
    rollup_lag?: number;
    recommendation?: string;
    error?: string;
  };

  if (error || !payload?.success) return null;

  return {
    score: payload.score ?? 0,
    pendingBufferedEvents: payload.pending_buffered_events ?? 0,
    todayVisitsRaw: payload.today_visits_raw ?? 0,
    todayVisitsRollup: payload.today_visits_rollup ?? 0,
    rollupLag: payload.rollup_lag ?? 0,
    recommendation: payload.recommendation ?? 'ok',
  };
};
