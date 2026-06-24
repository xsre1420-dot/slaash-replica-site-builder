import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { isProduction } from '../_shared/env.ts';
import { logStructured, withEdgeSpan } from '../_shared/observability.ts';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean);

const HTTP_CACHE_SECONDS = 120;
const EDGE_MEMORY_TTL_MS = 90_000;
const EDGE_MEMORY_MAX = 500;

function getCorsHeaders(origin: string | null): Record<string, string> | null {
  const base = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Cache-Control': `public, max-age=${HTTP_CACHE_SECONDS}, stale-while-revalidate=180`,
  };

  if (isProduction()) {
    if (ALLOWED_ORIGINS.length === 0) {
      console.error('[security] ALLOWED_ORIGINS must be set in production');
      return null;
    }
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      return null;
    }
    return { ...base, 'Access-Control-Allow-Origin': origin };
  }

  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] || '*');
  return { ...base, 'Access-Control-Allow-Origin': allowedOrigin };
}

const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 300;

const memoryCache = new Map<string, { body: string; expiresAt: number }>();

function getMemoryCached(key: string): string | null {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return hit.body;
}

function setMemoryCache(key: string, body: string): void {
  if (memoryCache.size >= EDGE_MEMORY_MAX) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, { body, expiresAt: Date.now() + EDGE_MEMORY_TTL_MS });
}

function getRealIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') || 'unknown';
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

function validateSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(slug);
}

function rpcParams(slug: string, limit: number, cursor: string | null, category: string | null, search: string | null) {
  return {
    p_slug: slug,
    p_limit: limit,
    p_cursor: cursor || '',
    p_category: category || '',
    p_search: search || '',
  };
}

Deno.serve(async (req) => {
  return withEdgeSpan('get-store-products', async () => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  const clientIP = getRealIP(req);

  if (!corsHeaders) {
    logStructured('warn', 'get-store-products.origin_blocked', { origin, clientIP });
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (isRateLimited(clientIP)) {
    logStructured('warn', 'get-store-products.rate_limited', { clientIP });
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const requestBody = await req.json();
    const slug = String(requestBody.slug || '').trim().toLowerCase();
    const cursor = requestBody.cursor ? String(requestBody.cursor) : '';
    const category = requestBody.category ? String(requestBody.category) : '';
    const search = requestBody.search ? String(requestBody.search) : '';
    const limit = Math.min(Math.max(Number(requestBody.limit) || 24, 1), 48);

    if (!slug || !validateSlug(slug)) {
      return new Response(JSON.stringify({ error: 'Valid slug is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const wantBundle = requestBody.bundle === true;
    const wantMetaOnly = requestBody.metaOnly === true;
    const wantProductsOnly = requestBody.page === true && !wantBundle && !wantMetaOnly;
    const cacheKey = `${slug}:${wantBundle ? 'bundle' : wantProductsOnly ? 'page' : 'meta'}:${cursor}:${category}:${search}:${limit}`;

    const cached = getMemoryCached(cacheKey);
    if (cached) {
      return new Response(cached, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: dbAllowed, error: rateErr } = await supabase.rpc('check_rpc_rate_limit', {
      p_key: `edge-store:${slug}:${clientIP}`,
      p_max: 120,
      p_window_seconds: 60,
    });
    if (rateErr || dbAllowed === false) {
      logStructured('warn', 'get-store-products.db_rate_limited', { clientIP, slug });
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    if (wantBundle) {
      const { data: bundle, error: bundleErr } = await supabase.rpc('get_storefront_page_bundle', {
        p_slug: slug,
        p_limit: limit,
        p_cursor: cursor,
        p_category: category,
        p_search: search,
      });

      if (bundleErr || !bundle?.store) {
        return new Response(JSON.stringify({ error: 'Store not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const payload = JSON.stringify({
        storeInfo: bundle.store,
        categories: bundle.categories || [],
        products: bundle.products || [],
        next_cursor: bundle.next_cursor || null,
        has_more: bundle.has_more || false,
        success: true,
      });
      setMemoryCache(cacheKey, payload);
      return new Response(payload, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
      });
    }

    if (wantMetaOnly) {
      const { data: meta, error: metaErr } = await supabase.rpc('get_store_meta', { p_slug: slug });
      if (metaErr || !meta?.store) {
        return new Response(JSON.stringify({ error: 'Store not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const payload = JSON.stringify({
        storeInfo: meta.store,
        categories: meta.categories || [],
        success: true,
      });
      setMemoryCache(cacheKey, payload);
      return new Response(payload, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
      });
    }

    const { data: page, error: pageErr } = await supabase.rpc(
      'get_store_products_page',
      rpcParams(slug, limit, cursor, category, search)
    );

    if (pageErr) {
      return new Response(JSON.stringify({ error: 'Failed to load products' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      products: page?.products || [],
      next_cursor: page?.next_cursor || null,
      has_more: page?.has_more || false,
      success: true,
    });
    setMemoryCache(cacheKey, payload);
    return new Response(payload, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    });
  } catch (error) {
    logStructured('error', 'get-store-products.error', {
      clientIP,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  }, { function: 'get-store-products' });
});
