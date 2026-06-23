import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { logStructured, withEdgeSpan } from '../_shared/observability.ts';
import { checkEdgeRateLimit, clientIpFromRequest } from '../_shared/rateLimiter.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const META_API_VERSION = 'v21.0';

async function sha256Hex(value: string): Promise<string> {
  const normalized = value.trim().toLowerCase().replace(/\D/g, '');
  const data = new TextEncoder().encode(normalized);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface MetaConversionPayload {
  store_slug: string;
  order_id: string;
  value: number;
  currency?: string;
  content_ids?: string[];
  customer_phone?: string | null;
  event_source_url?: string | null;
}

Deno.serve(async (req) => {
  return withEdgeSpan('meta-conversions', async () => {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      logStructured('error', 'meta-conversions.misconfigured');
      return new Response(JSON.stringify({ success: false, error: 'misconfigured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: MetaConversionPayload;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'invalid_json' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const clientIp = clientIpFromRequest(req);
    const rate = checkEdgeRateLimit(`meta:${clientIp}`, 30, 60 * 1000);
    if (!rate.allowed) {
      return new Response(JSON.stringify({ success: false, error: 'rate_limited' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const slug = body.store_slug?.trim().toLowerCase();
    const orderId = body.order_id?.trim();
    if (!slug || !orderId || !Number.isFinite(body.value)) {
      return new Response(JSON.stringify({ success: false, error: 'invalid_payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: storeRow } = await supabase
      .from('store_settings')
      .select('owner_id')
      .eq('store_slug', slug)
      .maybeSingle();

    let ownerId = storeRow?.owner_id as string | undefined;

    if (!ownerId) {
      const { data: storeFallback } = await supabase
        .from('stores')
        .select('user_id')
        .eq('store_slug', slug)
        .maybeSingle();
      ownerId = storeFallback?.user_id as string | undefined;
    }

    if (!ownerId) {
      return new Response(JSON.stringify({ success: false, error: 'store_not_found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: orderVerify, error: verifyError } = await supabase.rpc(
      'verify_order_for_meta_conversion',
      {
        p_order_id: orderId,
        p_owner_id: ownerId,
        p_expected_total: body.value,
      }
    );

    if (verifyError) {
      logStructured('warn', 'meta-conversions.verify_failed', { orderId, slug, message: verifyError.message });
      return new Response(JSON.stringify({ success: false, error: 'verification_failed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const verifyPayload = orderVerify as { success?: boolean; error?: string } | null;
    if (!verifyPayload?.success) {
      logStructured('warn', 'meta-conversions.order_rejected', {
        orderId,
        slug,
        reason: verifyPayload?.error ?? 'unknown',
      });
      return new Response(JSON.stringify({ success: false, error: verifyPayload?.error ?? 'invalid_order' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: settings } = await supabase
      .from('marketing_settings')
      .select('meta_pixel_id, facebook_access_token, marketing_enabled')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (
      !settings?.marketing_enabled ||
      !settings.meta_pixel_id?.trim() ||
      !settings.facebook_access_token?.trim()
    ) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'not_configured' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      undefined;
    const userAgent = req.headers.get('user-agent') || undefined;

    const userData: Record<string, unknown> = {};
    if (clientIp) userData.client_ip_address = clientIp;
    if (userAgent) userData.client_user_agent = userAgent;
    if (body.customer_phone?.trim()) {
      userData.ph = [await sha256Hex(body.customer_phone)];
    }

    const eventPayload = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: orderId,
          action_source: 'website',
          event_source_url: body.event_source_url || undefined,
          user_data: userData,
          custom_data: {
            currency: body.currency || 'IQD',
            value: body.value,
            content_ids: body.content_ids || [],
          },
        },
      ],
    };

    const pixelId = settings.meta_pixel_id.trim();
    const accessToken = settings.facebook_access_token.trim();
    const url = `https://graph.facebook.com/${META_API_VERSION}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`;

    const metaRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventPayload),
    });

    const metaBody = await metaRes.json().catch(() => ({}));

    if (!metaRes.ok) {
      logStructured('warn', 'meta-conversions.failed', { orderId, slug, metaBody });
      return new Response(JSON.stringify({ success: false, error: 'meta_api_error', details: metaBody }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    logStructured('info', 'meta-conversions.sent', { orderId, slug, events_received: metaBody?.events_received });
    return new Response(JSON.stringify({ success: true, meta: metaBody }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
});
