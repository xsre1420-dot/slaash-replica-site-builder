/**
 * Shared Supabase connection helpers for Node load-test / benchmark scripts.
 * Mirrors browser production behavior: REST URL + optional x-connection-mode: pooler.
 */

const FALSE_FLAGS = new Set(['false', '0', 'no', 'off']);
const TRUE_FLAGS = new Set(['true', '1', 'yes', 'on']);

/**
 * @param {Record<string, string | undefined>} env
 * @param {boolean | undefined} override Explicit --pooler=on|off from CLI
 */
export function shouldUseSupavisorPooler(env, override) {
  if (override === true) return true;
  if (override === false) return false;

  const explicit = env.VITE_SUPABASE_USE_POOLER?.trim().toLowerCase();
  if (explicit && FALSE_FLAGS.has(explicit)) return false;
  if (explicit && TRUE_FLAGS.has(explicit)) return true;
  if (env.VITE_SUPABASE_POOLER_URL?.trim()) return true;
  if (env.VITE_APP_ENV === 'production') return true;

  // Capacity probes default to pooler ON (matches production storefront under load).
  if (env.CAPACITY_PROBE_POOLER === 'off') return false;
  return true;
}

/** @param {Record<string, string | undefined>} env @param {boolean | undefined} override */
export function getSupabaseConnectionHeaders(env, override) {
  return shouldUseSupavisorPooler(env, override) ? { 'x-connection-mode': 'pooler' } : {};
}

export function resolveStorefrontEdgeUrl(env) {
  const explicit = env.VITE_STOREFRONT_EDGE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const disabled =
    env.VITE_STOREFRONT_EDGE_ENABLED === 'false' || env.VITE_STOREFRONT_EDGE_ENABLED === '0';
  if (disabled) return null;
  const enabled =
    env.VITE_STOREFRONT_EDGE_ENABLED === 'true' ||
    env.VITE_STOREFRONT_EDGE_ENABLED === '1' ||
    Boolean(explicit) ||
    env.VITE_APP_ENV === 'production' ||
    env.CAPACITY_PROBE_USE_EDGE === 'on' ||
    env.CAPACITY_PROBE_USE_EDGE === '1';
  let useEdge = enabled;
  if (!useEdge && env.CAPACITY_PROBE_USE_EDGE !== 'off') {
    useEdge = Boolean(env.VITE_SUPABASE_URL?.trim());
  }
  if (!useEdge) return null;
  const base = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  return base ? `${base}/functions/v1/get-store-products` : null;
}

/** Origin header for Edge CORS in capacity probes (matches ALLOWED_ORIGINS in production). */
export function resolveCapacityProbeOrigin(env) {
  const explicit = env.CAPACITY_PROBE_ORIGIN?.trim() || env.VITE_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return allowed[0] || null;
}

/** Shared probe headers: pooler + optional Origin for Edge GET. */
export function getCapacityProbeHeaders(env, poolerOverride) {
  const headers = { ...getSupabaseConnectionHeaders(env, poolerOverride) };
  const origin = resolveCapacityProbeOrigin(env);
  if (origin) headers.Origin = origin;
  headers['User-Agent'] = 'SlaashLoadTest/1.0';
  headers['X-Slaash-Capacity-Probe'] = '1';
  return headers;
}
