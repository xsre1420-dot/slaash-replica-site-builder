import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { isProduction } from '../_shared/env.ts';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean);

function getCorsHeaders(origin: string | null): Record<string, string> | null {
  const base = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
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
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX_REQUESTS = 60;

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

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  const clientIP = getRealIP(req);

  if (!corsHeaders) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (isRateLimited(clientIP)) {
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
    const cursor = requestBody.cursor ? String(requestBody.cursor) : null;
    const category = requestBody.category ? String(requestBody.category) : null;
    const search = requestBody.search ? String(requestBody.search) : null;
    const limit = Math.min(Math.max(Number(requestBody.limit) || 24, 1), 48);

    if (!slug || !validateSlug(slug)) {
      return new Response(JSON.stringify({ error: 'Valid slug is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const fetchMeta = requestBody.metaOnly === true || !requestBody.page;

    if (fetchMeta) {
      const { data: meta, error: metaErr } = await supabase.rpc('get_store_meta', { p_slug: slug });
      if (metaErr || !meta?.store) {
        return new Response(JSON.stringify({ error: 'Store not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: page, error: pageErr } = await supabase.rpc('get_store_products_page', {
        p_slug: slug,
        p_limit: limit,
        p_cursor: cursor,
        p_category: category,
        p_search: search,
      });

      if (pageErr) {
        return new Response(JSON.stringify({ error: 'Failed to load products' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        storeInfo: meta.store,
        categories: meta.categories || [],
        products: page?.products || [],
        next_cursor: page?.next_cursor || null,
        has_more: page?.has_more || false,
        success: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: page, error: pageErr } = await supabase.rpc('get_store_products_page', {
      p_slug: slug,
      p_limit: limit,
      p_cursor: cursor,
      p_category: category,
      p_search: search,
    });

    if (pageErr) {
      return new Response(JSON.stringify({ error: 'Failed to load products' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      products: page?.products || [],
      next_cursor: page?.next_cursor || null,
      has_more: page?.has_more || false,
      success: true,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`Error from IP ${clientIP}:`, error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
