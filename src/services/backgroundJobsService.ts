import { supabase } from '@/integrations/supabase/client';
import { assertMerchantOwner } from '@/lib/tenantGuard';

export type BackgroundJobsStatus = {
  status: 'ok' | 'warn' | 'degraded' | 'critical';
  analytics: {
    pending: number;
    oldestPendingSeconds: number;
    processor: string;
  };
  orderWebhooks: {
    pending: number;
    processing: number;
    failedDeadLetter: number;
    oldestPendingSeconds: number;
    processor: string;
  };
  recommendations: string[];
};

export type WebhookRetryResult = {
  reset: number;
};

/** Service-role only via RPC — returns null for merchant sessions. */
export const fetchBackgroundJobsStatus = async (): Promise<BackgroundJobsStatus | null> => {
  const { data, error } = await (supabase as any).rpc('get_background_jobs_status');
  const payload = data as {
    success?: boolean;
    status?: BackgroundJobsStatus['status'];
    analytics?: Record<string, unknown>;
    order_webhooks?: Record<string, unknown>;
    recommendations?: string[] | unknown;
  };

  if (error || !payload?.success) return null;

  const recs = payload.recommendations;
  const recommendations = Array.isArray(recs)
    ? recs.filter((r): r is string => typeof r === 'string')
    : [];

  return {
    status: payload.status ?? 'ok',
    analytics: {
      pending: Number(payload.analytics?.pending ?? 0),
      oldestPendingSeconds: Number(payload.analytics?.oldest_pending_seconds ?? 0),
      processor: String(payload.analytics?.processor ?? 'process_analytics_event_buffer'),
    },
    orderWebhooks: {
      pending: Number(payload.order_webhooks?.pending ?? 0),
      processing: Number(payload.order_webhooks?.processing ?? 0),
      failedDeadLetter: Number(payload.order_webhooks?.failed_dead_letter ?? 0),
      oldestPendingSeconds: Number(payload.order_webhooks?.oldest_pending_seconds ?? 0),
      processor: String(
        payload.order_webhooks?.processor ?? 'claim_order_webhook_outbox_batch'
      ),
    },
    recommendations,
  };
};

export const retryFailedWebhookEvents = async (
  ownerId: string,
  eventIds?: string[]
): Promise<WebhookRetryResult | null> => {
  await assertMerchantOwner(ownerId);

  const { data, error } = await (supabase as any).rpc('retry_order_webhook_events', {
    p_owner_id: ownerId,
    p_event_ids: eventIds?.length ? eventIds : null,
  });

  const payload = data as { success?: boolean; reset?: number };
  if (error || !payload?.success) return null;

  return { reset: payload.reset ?? 0 };
};
