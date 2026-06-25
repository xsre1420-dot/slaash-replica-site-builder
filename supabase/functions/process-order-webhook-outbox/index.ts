import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { logStructured, withEdgeSpan } from '../_shared/observability.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const WORKER_SECRET = Deno.env.get('BACKGROUND_WORKER_SECRET') || '';

const jsonHeaders = (extra: Record<string, string> = {}) => ({
  'Content-Type': 'application/json',
  ...extra,
});

type WebhookJob = {
  id: string;
  owner_id: string;
  order_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  attempts: number;
  webhook_url: string;
};

Deno.serve(async (req) => {
  return withEdgeSpan('process-order-webhook-outbox', async () => {
    if (req.method === 'OPTIONS') {
      return new Response('ok');
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'misconfigured' }), {
        status: 503,
        headers: jsonHeaders(),
      });
    }

    if (WORKER_SECRET) {
      const auth = req.headers.get('authorization') || '';
      if (auth !== `Bearer ${WORKER_SECRET}`) {
        return new Response(JSON.stringify({ success: false, error: 'unauthorized' }), {
          status: 401,
          headers: jsonHeaders(),
        });
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const limit = Math.min(
      Math.max(Number(new URL(req.url).searchParams.get('limit') || 50), 1),
      200
    );

    const { data: claimData, error: claimError } = await supabase.rpc(
      'claim_order_webhook_outbox_batch',
      { p_limit: limit }
    );

    if (claimError) {
      logStructured('error', 'webhook-outbox.claim_failed', { message: claimError.message });
      return new Response(JSON.stringify({ success: false, error: claimError.message }), {
        status: 500,
        headers: jsonHeaders(),
      });
    }

    const jobs = ((claimData as { jobs?: WebhookJob[] })?.jobs ?? []) as WebhookJob[];
    let delivered = 0;
    let failed = 0;
    let retried = 0;

    for (const job of jobs) {
      const url = job.webhook_url?.trim();
      if (!url) {
        await supabase.rpc('finalize_order_webhook_delivery', {
          p_id: job.id,
          p_success: true,
          p_error: 'no_webhook_configured',
        });
        delivered += 1;
        continue;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Slaash-Event': job.event_type,
            'X-Slaash-Delivery-Id': job.id,
          },
          body: JSON.stringify({
            event: job.event_type,
            data: job.payload,
            delivery_id: job.id,
            attempt: job.attempts,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const errorText = response.ok ? null : (await response.text()).slice(0, 2000);

        const { data: result } = await supabase.rpc('finalize_order_webhook_delivery', {
          p_id: job.id,
          p_success: response.ok,
          p_error: errorText,
        });

        const status = (result as { status?: string })?.status;
        if (status === 'delivered') delivered += 1;
        else if (status === 'failed') failed += 1;
        else retried += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const { data: result } = await supabase.rpc('finalize_order_webhook_delivery', {
          p_id: job.id,
          p_success: false,
          p_error: message,
        });
        const status = (result as { status?: string })?.status;
        if (status === 'failed') failed += 1;
        else retried += 1;
        logStructured('warn', 'webhook-outbox.delivery_error', {
          jobId: job.id,
          message,
        });
      }
    }

    const summary = {
      success: true,
      claimed: jobs.length,
      delivered_without_url: (claimData as { delivered_without_url?: number })?.delivered_without_url ?? 0,
      delivered,
      failed,
      retried,
    };

    logStructured('info', 'webhook-outbox.batch_complete', summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: jsonHeaders(),
    });
  });
});
