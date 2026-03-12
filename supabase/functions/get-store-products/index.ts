import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
};

// Rate limiting map
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX_REQUESTS = 30;

function getRealIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0] || 
         req.headers.get('x-real-ip') || 
         'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);
  
  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) return true;
  record.count++;
  return false;
}

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of requestCounts.entries()) {
    if (now > record.resetTime) requestCounts.delete(ip);
  }
}, 300000);

function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// In-memory response cache for edge function
const responseCache = new Map<string, { data: string; timestamp: number }>();
const RESPONSE_CACHE_TTL = 30000; // 30s

Deno.serve(async (req) => {
  const clientIP = getRealIP(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (isRateLimited(clientIP)) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
    );
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { ownerId } = requestBody;
    
    if (!ownerId || typeof ownerId !== 'string' || !validateUUID(ownerId)) {
      return new Response(
        JSON.stringify({ error: 'Valid Owner ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check response cache
    const cachedResponse = responseCache.get(ownerId);
    if (cachedResponse && Date.now() - cachedResponse.timestamp < RESPONSE_CACHE_TTL) {
      return new Response(cachedResponse.data, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Single parallel batch for all 3 queries
    const [productsRes, categoriesRes, settingsRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, description, category, price, image_url, additional_images')
        .eq('owner_id', ownerId)
        .eq('is_active', true),
      supabase
        .from('categories')
        .select('id, name, display_order')
        .eq('owner_id', ownerId)
        .order('display_order'),
      supabase
        .from('store_settings')
        .select('store_name, store_logo, menu_background_color, menu_text_color, menu_accent_color, banner_images, primary_banner_index')
        .eq('owner_id', ownerId)
        .single(),
    ]);

    if (productsRes.error) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch products' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseBody = JSON.stringify({
      products: productsRes.data,
      categories: categoriesRes.data || [],
      storeInfo: settingsRes.error ? null : settingsRes.data,
      success: true
    });

    // Cache the response
    responseCache.set(ownerId, { data: responseBody, timestamp: Date.now() });

    return new Response(responseBody, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
    });

  } catch (error) {
    console.error(`Unexpected error from IP ${clientIP}:`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
