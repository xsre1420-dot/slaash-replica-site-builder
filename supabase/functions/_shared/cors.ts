import { isProduction } from './env.ts';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Local Vite/dev servers — safe to allow for access-code login during development. */
const isLocalDevOrigin = (origin: string): boolean =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

export function getEdgeCorsHeaders(origin: string | null): Record<string, string> | null {
  const base = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (origin && isLocalDevOrigin(origin)) {
    return { ...base, 'Access-Control-Allow-Origin': origin };
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

  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || '*';
  return { ...base, 'Access-Control-Allow-Origin': allowedOrigin };
}

/** Require Supabase client Authorization header (anon or user JWT). */
export function hasSupabaseAuthHeader(req: Request): boolean {
  const auth = req.headers.get('authorization')?.trim();
  return !!auth && auth.toLowerCase().startsWith('bearer ');
}
