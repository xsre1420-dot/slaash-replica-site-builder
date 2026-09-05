import { getAnonSupabase } from '../_shared/supabaseClient.ts';
import { isProduction } from '../_shared/env.ts';
import { logStructured, withEdgeSpan } from '../_shared/observability.ts';
import { verifyMerchantOwnsSlug } from '../_shared/merchantAuth.ts';
import {
  buildCoalesceKey,
  buildPayloadKey,
  coalesceStorefrontFetch,
  edgeCacheControlHeader,
  edgeCacheStats,
  edgeCacheTagHeader,
  isEdgeKvEnabled,
  purgeSlugFromCaches,
  resolveCachedPayload,
  type StorefrontFetchMeta,
} from '../_shared/edgeCache.ts';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean);

function isCapacityProbe(req: Request): boolean {
  return req.headers.get('x-slaash-capacity-probe') === '1';
}

function getCorsHeaders(origin: string | null, req?: Request): Record<string, string> | null {
  const base = {
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-slaash-capacity-probe',
    'Cache-Control': edgeCacheControlHeader(),
  };

  if (req && isCapacityProbe(req) && req.method === 'GET') {
    const probeOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    if (probeOrigin) {
      return { ...base, 'Access-Control-Allow-Origin': probeOrigin };
    }
  }

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

function getRealIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') || 'unknown';
}

function isRateLimited(ip: string, req?: Request): boolean {
  if (req && isCapacityProbe(req)) return false;

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

type StorefrontRequest = {
  slug: string;
  cursor: string;
  category: string;
  search: string;
  limit: number;
  kind: 'bundle' | 'page' | 'meta';
  purge: boolean;
};

function rpcParams(slug: string, limit: number, cursor: string, category: string, search: string) {
  return {
    p_slug: slug,
    p_limit: limit,
    p_cursor: cursor || '',
    p_category: category || '',
    p_search: search || '',
  };
}

function jsonResponse(
  body: string,
  corsHeaders: Record<string, string>,
  cacheStatus: 'HIT' | 'MISS' | 'PURGE',
  slug: string,
  version?: number,
  fetchMeta?: StorefrontFetchMeta,
  includeProbeDiagnostics = false
): Response {
  const headers: Record<string, string> = {
    ...corsHeaders,
    'Content-Type': 'application/json',
    'X-Cache': cacheStatus,
    'Cache-Tag': edgeCacheTagHeader(slug),
    Vary: 'Accept-Encoding',
  };
  if (version != null) {
    headers['ETag'] = `"storefront-v${version}"`;
  }
  if (includeProbeDiagnostics && fetchMeta) {
    headers['X-Slaash-Cache-Layer'] = fetchMeta.layer;
    headers['X-Slaash-Origin-Rpc'] = String(fetchMeta.originRpc);
    headers['X-Slaash-Coalesced'] = fetchMeta.coalesced ? '1' : '0';
    headers['X-Slaash-Kv-Enabled'] = isEdgeKvEnabled() ? '1' : '0';
  }
  return new Response(body, { status: 200, headers });
}

async function parseGetRequest(req: Request): Promise<StorefrontRequest | null> {
  const url = new URL(req.url);
  const slug = String(url.searchParams.get('slug') || '').trim().toLowerCase();
  if (!slug) return null;

  const wantBundle = url.searchParams.get('bundle') === '1' || url.searchParams.get('bundle') === 'true';
  const wantMetaOnly = url.searchParams.get('meta') === '1' || url.searchParams.get('meta') === 'true';
  const wantPage = url.searchParams.get('page') === '1' || url.searchParams.get('page') === 'true';

  const kind = wantBundle ? 'bundle' : wantPage && !wantBundle && !wantMetaOnly ? 'page' : wantMetaOnly ? 'meta' : 'bundle';

  return {
    slug,
    cursor: url.searchParams.get('cursor') || '',
    category: url.searchParams.get('category') || '',
    search: url.searchParams.get('search') || '',
    limit: Math.min(Math.max(Number(url.searchParams.get('limit')) || 24, 1), 48),
    kind,
    purge: false,
  };
}

async function parsePostRequest(req: Request): Promise<StorefrontRequest | null> {
  const requestBody = await req.json();
  const slug = String(requestBody.slug || '').trim().toLowerCase();
  if (!slug) return null;

  const wantBundle = requestBody.bundle === true;
  const wantMetaOnly = requestBody.metaOnly === true;
  const wantProductsOnly = requestBody.page === true && !wantBundle && !wantMetaOnly;
  const kind = wantBundle ? 'bundle' : wantProductsOnly ? 'page' : wantMetaOnly ? 'meta' : 'bundle';

  return {
    slug,
    cursor: requestBody.cursor ? String(requestBody.cursor) : '',
    category: requestBody.category ? String(requestBody.category) : '',
    search: requestBody.search ? String(requestBody.search) : '',
    limit: Math.min(Math.max(Number(requestBody.limit) || 24, 1), 48),
    kind,
    purge: requestBody.purge === true,
  };
}

async function fetchBundlePayload(
  supabase: ReturnType<typeof getAnonSupabase>,
  req: StorefrontRequest
): Promise<{ body: string; version: number; payloadKey: string; originRpc: number } | null> {
  const { data: bundle, error: bundleErr } = await supabase.rpc('get_storefront_page_bundle', rpcParams(
    req.slug,
    req.limit,
    req.cursor,
    req.category,
    req.search
  ));

  if (bundleErr || !bundle?.store) return null;

  const version = Number(bundle.cache_version ?? 1);
  const payload = JSON.stringify({
    storeInfo: bundle.store,
    hero: bundle.hero || null,
    featured: bundle.featured || [],
    categories: bundle.categories || [],
    products: bundle.products || [],
    next_cursor: bundle.next_cursor || null,
    has_more: bundle.has_more || false,
    cache_version: version,
    success: true,
  });
  const payloadKey = buildPayloadKey(req.slug, version, 'bundle', req.cursor, req.category, req.search, req.limit);
  return { body: payload, version, payloadKey, originRpc: 1 };
}

async function fetchMetaPayload(
  supabase: ReturnType<typeof getAnonSupabase>,
  req: StorefrontRequest
): Promise<{ body: string; version: number; payloadKey: string; originRpc: number } | null> {
  const { data: meta, error: metaErr } = await supabase.rpc('get_store_meta', { p_slug: req.slug });
  if (metaErr || !meta?.store) return null;

  const version = Number(meta.cache_version ?? 1);
  const payload = JSON.stringify({
    storeInfo: meta.store,
    categories: meta.categories || [],
    cache_version: version,
    success: true,
  });
  const payloadKey = buildPayloadKey(req.slug, version, 'meta', req.cursor, req.category, req.search, req.limit);
  return { body: payload, version, payloadKey, originRpc: 1 };
}

async function fetchPagePayload(
  supabase: ReturnType<typeof getAnonSupabase>,
  req: StorefrontRequest
): Promise<{ body: string; version: number; payloadKey: string; originRpc: number } | null> {
  const { data: page, error: pageErr } = await supabase.rpc(
    'get_store_products_page',
    rpcParams(req.slug, req.limit, req.cursor, req.category, req.search)
  );
  if (pageErr) return null;

  const version = Number(page?.cache_version ?? 1);
  const payload = JSON.stringify({
    products: page?.products || [],
    next_cursor: page?.next_cursor || null,
    has_more: page?.has_more || false,
    cache_version: version,
    success: true,
  });
  const payloadKey = buildPayloadKey(req.slug, version, 'page', req.cursor, req.category, req.search, req.limit);
  return { body: payload, version, payloadKey, originRpc: 1 };
}

async function resolveStorefrontPayload(
  supabase: ReturnType<typeof getAnonSupabase>,
  req: StorefrontRequest
): Promise<StorefrontFetchMeta | null> {
  const cached = await resolveCachedPayload(
    req.slug,
    req.kind,
    req.cursor,
    req.category,
    req.search,
    req.limit
  );
  if (cached) {
    return { ...cached, originRpc: 0, coalesced: false };
  }

  const coalesceKey = buildCoalesceKey(
    req.slug,
    req.kind,
    req.cursor,
    req.category,
    req.search,
    req.limit
  );

  return coalesceStorefrontFetch(coalesceKey, async () => {
    const retryCached = await resolveCachedPayload(
      req.slug,
      req.kind,
      req.cursor,
      req.category,
      req.search,
      req.limit
    );
    if (retryCached) {
      const payloadKey = buildPayloadKey(
        req.slug,
        retryCached.version,
        req.kind,
        req.cursor,
        req.category,
        req.search,
        req.limit
      );
      return {
        body: retryCached.body,
        version: retryCached.version,
        payloadKey,
        originRpc: 0,
        layer: retryCached.layer,
      };
    }

    if (req.kind === 'bundle') {
      const result = await fetchBundlePayload(supabase, req);
      if (!result) throw new Error('store_not_found');
      return result;
    }
    if (req.kind === 'meta') {
      const result = await fetchMetaPayload(supabase, req);
      if (!result) throw new Error('store_not_found');
      return result;
    }
    const result = await fetchPagePayload(supabase, req);
    if (!result) throw new Error('page_failed');
    return result;
  });
}

Deno.serve(async (req) => {
  return withEdgeSpan('get-store-products', async () => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin, req);
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

  if (isRateLimited(clientIP, req)) {
    logStructured('warn', 'get-store-products.rate_limited', { clientIP });
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const parsed = req.method === 'GET'
      ? await parseGetRequest(req)
      : await parsePostRequest(req);

    if (!parsed) {
      return new Response(JSON.stringify({ error: 'Valid slug is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { slug } = parsed;
    if (!validateSlug(slug)) {
      return new Response(JSON.stringify({ error: 'Valid slug is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (parsed.purge) {
      if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Purge requires POST' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const ownsSlug = await verifyMerchantOwnsSlug(req, slug);
      if (!ownsSlug) {
        logStructured('warn', 'get-store-products.purge_denied', { slug, clientIP });
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const removed = await purgeSlugFromCaches(slug);
      logStructured('info', 'get-store-products.purge', {
        slug,
        removed,
        stats: edgeCacheStats(),
        kvEnabled: isEdgeKvEnabled(),
      });
      return new Response(JSON.stringify({ success: true, purged: removed }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'PURGE' },
      });
    }

    const probeDiagnostics = isCapacityProbe(req);

    const cacheProbe = await resolveCachedPayload(
      slug,
      parsed.kind,
      parsed.cursor,
      parsed.category,
      parsed.search,
      parsed.limit
    );
    if (cacheProbe) {
      const fetchMeta: StorefrontFetchMeta = {
        ...cacheProbe,
        originRpc: 0,
        coalesced: false,
      };
      return jsonResponse(
        cacheProbe.body,
        corsHeaders,
        'HIT',
        slug,
        cacheProbe.version,
        fetchMeta,
        probeDiagnostics
      );
    }

    const supabase = getAnonSupabase();

    const resolved = await resolveStorefrontPayload(supabase, parsed);
    if (!resolved) {
      const status = parsed.kind === 'page' ? 500 : 404;
      const message = parsed.kind === 'page' ? 'Failed to load products' : 'Store not found';
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return jsonResponse(
      resolved.body,
      corsHeaders,
      'MISS',
      slug,
      resolved.version,
      resolved,
      probeDiagnostics
    );
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
