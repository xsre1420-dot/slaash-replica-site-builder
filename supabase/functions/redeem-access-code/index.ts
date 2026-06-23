import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { logStructured, withEdgeSpan } from '../_shared/observability.ts';
import { addMonths, hashAccessCode } from '../_shared/accessCodeUtils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RedeemBody {
  code: string;
  store_name?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return withEdgeSpan('redeem-access-code', async () => {
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

    let body: RedeemBody;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawCode = body.code?.trim();
    if (!rawCode || rawCode.replace(/[^A-Za-z0-9]/g, '').length < 8) {
      return new Response(JSON.stringify({ success: false, error: 'invalid_code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const codeHash = await hashAccessCode(rawCode);

    const { data: codeRow, error: codeError } = await adminClient
      .from('merchant_access_codes')
      .select('*')
      .eq('code_hash', codeHash)
      .maybeSingle();

    if (codeError || !codeRow) {
      return new Response(JSON.stringify({ success: false, error: 'invalid_code' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (codeRow.status === 'revoked') {
      return new Response(JSON.stringify({ success: false, error: 'code_revoked' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (codeRow.status === 'expired' && !codeRow.redeemed_user_id) {
      return new Response(JSON.stringify({ success: false, error: 'code_expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();

    const storeName = body.store_name?.trim() || codeRow.store_name || 'متجري';
    const username = codeRow.username || `store${Math.floor(10000 + Math.random() * 90000)}`;
    let userId = codeRow.redeemed_user_id as string | null;
    let subscriptionEndAt = codeRow.subscription_end_at as string | null;

    if (!userId) {
      const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
        email: codeRow.auth_email,
        password: codeRow.auth_password,
        email_confirm: true,
        user_metadata: {
          username,
          store_name: storeName,
          lead_id: codeRow.lead_id,
          sales_assigned: true,
          access_code_id: codeRow.id,
        },
      });

      if (createError || !createdUser.user) {
        logStructured('error', 'redeem-access-code.create_user_failed', { message: createError?.message });
        return new Response(JSON.stringify({ success: false, error: 'activation_failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      userId = createdUser.user.id;
      const subscriptionEnd = addMonths(now, codeRow.duration_months).toISOString();
      subscriptionEndAt = subscriptionEnd;

      const { error: subError } = await adminClient.from('subscriptions').upsert(
        {
          user_id: userId,
          plan_name: codeRow.plan_id,
          start_date: now.toISOString(),
          end_date: subscriptionEnd,
          status: 'active',
          lead_id: codeRow.lead_id,
          converted_at: now.toISOString(),
          notes: codeRow.agreed_price
            ? `سعر متفق عليه: ${codeRow.agreed_price} د.ع`
            : null,
        },
        { onConflict: 'user_id' }
      );

      if (subError) {
        logStructured('error', 'redeem-access-code.subscription_failed', { message: subError.message });
        await adminClient.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ success: false, error: 'activation_failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await adminClient
        .from('leads')
        .update({
          status: 'customer',
          converted_user_id: userId,
          converted_at: now.toISOString(),
          admin_read_at: now.toISOString(),
        })
        .eq('id', codeRow.lead_id);

      await adminClient
        .from('merchant_access_codes')
        .update({
          status: 'redeemed',
          redeemed_at: now.toISOString(),
          redeemed_user_id: userId,
          subscription_end_at: subscriptionEnd,
          store_name: storeName,
          username,
        })
        .eq('id', codeRow.id);
    } else {
      const subscriptionEnd = codeRow.subscription_end_at
        ? new Date(codeRow.subscription_end_at)
        : null;

      if (subscriptionEnd && now > subscriptionEnd) {
        await adminClient
          .from('subscriptions')
          .update({ status: 'expired' })
          .eq('user_id', userId);
        return new Response(JSON.stringify({ success: false, error: 'subscription_expired' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: subRow } = await adminClient
        .from('subscriptions')
        .select('status, end_date')
        .eq('user_id', userId)
        .maybeSingle();

      if (!subRow || subRow.status !== 'active') {
        return new Response(JSON.stringify({ success: false, error: 'subscription_expired' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (subRow.end_date && new Date(subRow.end_date) < now) {
        return new Response(JSON.stringify({ success: false, error: 'subscription_expired' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({
      email: codeRow.auth_email,
      password: codeRow.auth_password,
    });

    if (signInError || !sessionData.session) {
      logStructured('error', 'redeem-access-code.sign_in_failed', { message: signInError?.message });
      return new Response(JSON.stringify({ success: false, error: 'login_failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
          expires_in: sessionData.session.expires_in,
          expires_at: sessionData.session.expires_at,
        },
        user: {
          id: userId,
          username,
          store_name: storeName,
        },
        subscription_end_at: subscriptionEndAt,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  });
});
