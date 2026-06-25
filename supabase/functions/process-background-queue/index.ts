import { getServiceSupabase } from '../_shared/supabaseClient.ts';
import { logStructured, withEdgeSpan } from '../_shared/observability.ts';

const WORKER_SECRET = Deno.env.get('BACKGROUND_WORKER_SECRET') || '';

const jsonHeaders = (extra: Record<string, string> = {}) => ({
  'Content-Type': 'application/json',
  ...extra,
});

Deno.serve(async (req) => {
  return withEdgeSpan('process-background-queue', async () => {
    if (req.method === 'OPTIONS') {
      return new Response('ok');
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
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

    const supabase = getServiceSupabase();
    const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get('limit') || 50), 1), 200);

    const results: Record<string, unknown> = { ran_at: new Date().toISOString() };

    const { data: sideEffects } = await supabase.rpc('process_order_side_effects_batch', { p_limit: limit });
    results.side_effects = sideEffects;

    const { data: analytics } = await supabase.rpc('process_analytics_event_buffer', { p_limit: Math.min(limit * 4, 500) });
    results.analytics = analytics;

    const { data: recovered } = await supabase.rpc('recover_stale_webhook_processing', { p_stale_minutes: 15 });
    results.webhook_recovery = recovered;

    const { data: lifecycle } = await supabase.rpc('platform_run_data_lifecycle');
    results.lifecycle = lifecycle;

    logStructured('info', 'background-queue.completed', {
      sideEffects: sideEffects,
      analyticsProcessed: analytics,
    });

    return new Response(JSON.stringify({ success: true, ...results }), {
      status: 200,
      headers: jsonHeaders(),
    });
  }, { function: 'process-background-queue' });
});
