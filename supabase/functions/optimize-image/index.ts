import { getEdgeCorsHeaders } from '../_shared/cors.ts';

/**
 * Lightweight image transform proxy — point CDN (Cloudflare Images / imgproxy) via IMAGE_TRANSFORM_BASE.
 * Example: IMAGE_TRANSFORM_BASE=https://cdn.example.com/transform?url=
 */
const TRANSFORM_BASE = (Deno.env.get('IMAGE_TRANSFORM_BASE') || '').replace(/\/$/, '');

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = getEdgeCorsHeaders(origin);
  if (!cors) {
    return new Response(JSON.stringify({ error: 'origin_not_allowed' }), { status: 403 });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const url = new URL(req.url);
  const src = url.searchParams.get('url')?.trim();
  const width = Math.min(Math.max(Number(url.searchParams.get('w') ?? 800), 64), 2000);

  if (!src || !/^https:\/\//i.test(src)) {
    return new Response(JSON.stringify({ error: 'invalid_url' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (TRANSFORM_BASE) {
    const target = `${TRANSFORM_BASE}${encodeURIComponent(src)}&w=${width}`;
    return Response.redirect(target, 302);
  }

  return new Response(JSON.stringify({ url: src, width, transformed: false }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
  });
});
