import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { logStructured, withEdgeSpan } from '../_shared/observability.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConvertLeadBody {
  lead_id: string;
  email: string;
  username: string;
  password: string;
  store_name?: string;
  plan_name?: string;
  end_date?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return withEdgeSpan('convert-lead', async () => {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isAdmin, error: adminError } = await userClient.rpc('is_platform_admin');
    if (adminError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: ConvertLeadBody;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      lead_id,
      email,
      username,
      password,
      store_name,
      plan_name = 'standard',
      end_date = null,
    } = body;

    if (!lead_id || !email?.trim() || !username?.trim() || !password) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

    const { data: lead, error: leadError } = await adminClient
      .from('leads')
      .select('id, status, converted_user_id')
      .eq('id', lead_id)
      .maybeSingle();

    if (leadError || !lead) {
      return new Response(JSON.stringify({ error: 'Lead not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (lead.converted_user_id) {
      return new Response(JSON.stringify({ error: 'Lead already converted' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: {
        username: normalizedUsername,
        store_name: store_name?.trim() || 'متجري',
        lead_id,
        sales_assigned: true,
      },
    });

    if (createError || !createdUser.user) {
      logStructured('error', 'convert-lead.create_user_failed', { message: createError?.message });
      return new Response(JSON.stringify({ error: createError?.message || 'Failed to create user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = createdUser.user.id;
    const now = new Date().toISOString();

    const { error: subError } = await adminClient.from('subscriptions').upsert(
      {
        user_id: userId,
        plan_name: plan_name.trim() || 'standard',
        start_date: now,
        end_date: end_date || null,
        status: 'active',
        lead_id,
        converted_at: now,
      },
      { onConflict: 'user_id' }
    );

    if (subError) {
      logStructured('error', 'convert-lead.subscription_failed', { message: subError.message });
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: subError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: leadUpdateError } = await adminClient
      .from('leads')
      .update({
        status: 'customer',
        converted_user_id: userId,
        converted_at: now,
        admin_read_at: now,
      })
      .eq('id', lead_id);

    if (leadUpdateError) {
      logStructured('warn', 'convert-lead.lead_update_failed', { message: leadUpdateError.message });
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email: email.trim(),
        username: normalizedUsername,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  });
});
