import { getUserSupabase } from '../_shared/supabaseClient.ts';
import { getEdgeCorsHeaders, hasSupabaseAuthHeader } from '../_shared/cors.ts';
import { logStructured } from '../_shared/observability.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = getEdgeCorsHeaders(origin);
  if (!cors) {
    return new Response(JSON.stringify({ error: 'origin_not_allowed' }), { status: 403 });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (!hasSupabaseAuthHeader(req)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'misconfigured' }), { status: 500, headers: cors });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const userClient = getUserSupabase(authHeader);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let body: { job_id?: string; batch_size?: number } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const jobId = body.job_id?.trim();
  if (!jobId) {
    return new Response(JSON.stringify({ error: 'job_id_required' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { data, error } = await userClient.rpc('process_product_import_batch', {
    p_job_id: jobId,
    p_batch_size: body.batch_size ?? 25,
  });

  if (error) {
    logStructured('warn', 'process-import-jobs.failed', { jobId, message: error.message });
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
