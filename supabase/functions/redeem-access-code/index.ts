import { getAnonSupabase, getServiceSupabase } from '../_shared/supabaseClient.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { logStructured, withEdgeSpan } from '../_shared/observability.ts';
import { addMonths, generateAuthPassword, hashAccessCode } from '../_shared/accessCodeUtils.ts';
import { checkEdgeRateLimit, clientIpFromRequest } from '../_shared/rateLimiter.ts';
import { getEdgeCorsHeaders } from '../_shared/cors.ts';

interface RedeemBody {
  code: string;
  store_name?: string;
  preview?: boolean;
}

const signInWithEphemeralPassword = async (
  adminClient: SupabaseClient,
  authClient: SupabaseClient,
  userId: string,
  email: string
) => {
  const tempPassword = generateAuthPassword();
  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });

  if (updateError) {
    throw updateError;
  }

  const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password: tempPassword,
  });

  if (signInError || !sessionData.session) {
    throw signInError ?? new Error('session_missing');
  }

  return sessionData.session;
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getEdgeCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    if (!corsHeaders) return new Response('Forbidden', { status: 403 });
    return new Response('ok', { headers: corsHeaders });
  }

  return withEdgeSpan('redeem-access-code', async () => {
    if (!corsHeaders) {
      return new Response(JSON.stringify({ error: 'Forbidden origin' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    const clientIp = clientIpFromRequest(req);
    const rate = checkEdgeRateLimit(`redeem:${clientIp}`, 8, 15 * 60 * 1000);
    if (!rate.allowed) {
      return new Response(
        JSON.stringify({ success: false, error: 'rate_limited', retry_after_sec: rate.retryAfterSec }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const rawCode = body.code?.trim();
    if (!rawCode || rawCode.replace(/[^A-Za-z0-9]/g, '').length < 8) {
      return new Response(JSON.stringify({ success: false, error: 'invalid_code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = getServiceSupabase();
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

    if (body.preview === true) {
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

      if (codeRow.status !== 'active' && codeRow.status !== 'redeemed') {
        return new Response(JSON.stringify({ success: false, error: 'code_expired' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          preview: true,
          plan_id: codeRow.plan_id,
          duration_months: codeRow.duration_months,
          agreed_price: codeRow.agreed_price,
          store_name: codeRow.store_name,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();

    const storeName = body.store_name?.trim() || codeRow.store_name || 'متجري';
    const username = codeRow.username || `store${Math.floor(10000 + Math.random() * 90000)}`;
    let userId = codeRow.redeemed_user_id as string | null;
    let subscriptionEndAt = codeRow.subscription_end_at as string | null;

    const ensureStoreProvision = async (targetUserId: string): Promise<boolean> => {
      const { data: provisionData, error: provisionError } = await adminClient.rpc(
        'provision_merchant_store',
        {
          p_user_id: targetUserId,
          p_store_name: storeName,
          p_username: username,
        }
      );
      if (provisionError || !(provisionData as { success?: boolean })?.success) {
        logStructured('error', 'redeem-access-code.provision_failed', {
          message: provisionError?.message,
          data: provisionData,
        });
        return false;
      }
      return true;
    };

    if (!userId) {
      const initialPassword = generateAuthPassword();
      const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
        email: codeRow.auth_email,
        password: initialPassword,
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
        logStructured('error', 'redeem-access-code.create_user_failed', {
          message: createError?.message,
          email: codeRow.auth_email,
        });
        return new Response(JSON.stringify({ success: false, error: 'create_user_failed' }), {
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
        return new Response(JSON.stringify({ success: false, error: 'subscription_failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!(await ensureStoreProvision(userId))) {
        await adminClient.auth.admin.deleteUser(userId);
        await adminClient.from('subscriptions').delete().eq('user_id', userId);
        return new Response(JSON.stringify({ success: false, error: 'provision_failed' }), {
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

      if (!(await ensureStoreProvision(userId as string))) {
        return new Response(JSON.stringify({ success: false, error: 'provision_failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const authClient = getAnonSupabase();
    let session;
    try {
      session = await signInWithEphemeralPassword(
        adminClient,
        authClient,
        userId as string,
        codeRow.auth_email as string
      );
    } catch (signInErr) {
      logStructured('error', 'redeem-access-code.sign_in_failed', {
        message: signInErr instanceof Error ? signInErr.message : String(signInErr),
      });
      return new Response(JSON.stringify({ success: false, error: 'login_failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          expires_at: session.expires_at,
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
