import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function verifyStripeSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!secret || !signature) return false;

  const parts = Object.fromEntries(
    signature.split(',').map((p) => {
      const [k, v] = p.split('=');
      return [k, v];
    })
  );

  const timestamp = parts['t'];
  const sig = parts['v1'];
  if (!timestamp || !sig) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return timingSafeEqual(expected, sig);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature') || '';

  if (STRIPE_WEBHOOK_SECRET) {
    const valid = await verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    if (!valid) {
      console.error('Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
    }
  } else {
    console.warn('STRIPE_WEBHOOK_SECRET not set — webhook validation disabled');
  }

  let event: { id?: string; type?: string; data?: unknown };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const eventId = event.id || `anon-${Date.now()}`;
  const eventType = event.type || 'unknown';

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data, error } = await supabase.rpc('process_payment_webhook_event', {
    p_provider: 'stripe',
    p_event_id: eventId,
    p_event_type: eventType,
    p_payload: event,
  });

  if (error) {
    console.error('Webhook processing failed:', error);
    return new Response(JSON.stringify({ error: 'Processing failed' }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true, ...data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
