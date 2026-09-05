/**
 * Version-aware edge cache for public storefront reads.
 * Keys: {slug}:v{version}:{kind}:{cursor}:{category}:{search}:{limit}
 * Coalesce keys (stampede): coalesce:{slug}:{kind}:...
 * Optional L2: UPSTASH_REDIS_REST_URL for cross-isolate payload + version.
 */
import { edgeKvDel, edgeKvGet, edgeKvSet, isEdgeKvEnabled } from './distributedKv.ts';

const EDGE_MEMORY_TTL_MS = 120_000;
const EDGE_VERSION_TTL_MS = 30_000;
const EDGE_MEMORY_MAX = 5_000;
const EDGE_VERSION_MAX = 8_000;

/** KV version TTL aligned with payload TTL so cold isolates can resolve version from shared KV. */
const EDGE_KV_VERSION_TTL_SECONDS = Math.ceil(EDGE_MEMORY_TTL_MS / 1000);

/** HTTP Cache-Control for CDN — aligned with CacheTTLPolicy.edge.bundle */
export const EDGE_HTTP_MAX_AGE_SECONDS = 120;
export const EDGE_HTTP_SWR_SECONDS = 180;

export type StorefrontCacheLayer = 'L1' | 'KV' | 'ORIGIN';

export type ResolvedStorefrontPayload = {
  body: string;
  version: number;
  layer: StorefrontCacheLayer;
};

export type StorefrontFetchMeta = ResolvedStorefrontPayload & {
  originRpc: number;
  coalesced: boolean;
};

type PayloadEntry = { body: string; version: number; expiresAt: number };
type VersionEntry = { version: number; expiresAt: number };

const payloadCache = new Map<string, PayloadEntry>();
const versionCache = new Map<string, VersionEntry>();
const inflightFetches = new Map<string, Promise<StorefrontFetchMeta>>();

function pruneExpiredPayloads(): void {
  const now = Date.now();
  for (const [key, hit] of payloadCache) {
    if (now > hit.expiresAt) payloadCache.delete(key);
  }
  for (const [key, hit] of versionCache) {
    if (now > hit.expiresAt) versionCache.delete(key);
  }
}

export function edgeCacheStats(): {
  payloadEntries: number;
  versionEntries: number;
  inflightEntries: number;
  kvEnabled: boolean;
} {
  return {
    payloadEntries: payloadCache.size,
    versionEntries: versionCache.size,
    inflightEntries: inflightFetches.size,
    kvEnabled: isEdgeKvEnabled(),
  };
}

export function getCachedVersion(slug: string): number | null {
  const hit = versionCache.get(slug);
  if (hit && Date.now() <= hit.expiresAt) {
    return hit.version;
  }
  if (hit) versionCache.delete(slug);
  return null;
}

export async function getCachedVersionAsync(slug: string): Promise<number | null> {
  const local = getCachedVersion(slug);
  if (local != null) return local;
  if (!isEdgeKvEnabled()) return null;
  const raw = await edgeKvGet(`sf:v:${slug}`);
  if (!raw) return null;
  const version = Number(raw);
  if (!Number.isFinite(version)) return null;
  setCachedVersion(slug, version);
  return version;
}

export function setCachedVersion(slug: string, version: number): void {
  if (versionCache.size >= EDGE_VERSION_MAX) {
    const oldest = versionCache.keys().next().value;
    if (oldest) versionCache.delete(oldest);
  }
  versionCache.set(slug, { version, expiresAt: Date.now() + EDGE_VERSION_TTL_MS });
  if (isEdgeKvEnabled()) {
    void edgeKvSet(`sf:v:${slug}`, String(version), EDGE_KV_VERSION_TTL_SECONDS);
  }
}

export function buildPayloadKey(
  slug: string,
  version: number,
  kind: 'bundle' | 'page' | 'meta',
  cursor: string,
  category: string,
  search: string,
  limit: number
): string {
  return `${slug}:v${version}:${kind}:${cursor}:${category}:${search}:${limit}`;
}

/** Stampede coalescing — excludes version so concurrent misses share one origin fetch. */
export function buildCoalesceKey(
  slug: string,
  kind: 'bundle' | 'page' | 'meta',
  cursor: string,
  category: string,
  search: string,
  limit: number
): string {
  return `coalesce:${slug}:${kind}:${cursor}:${category}:${search}:${limit}`;
}

export function getMemoryCached(key: string, currentVersion: number): string | null {
  if (payloadCache.size >= EDGE_MEMORY_MAX * 0.9) {
    pruneExpiredPayloads();
  }
  const hit = payloadCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt || hit.version !== currentVersion) {
    payloadCache.delete(key);
    return null;
  }
  return hit.body;
}

export function setMemoryCache(key: string, body: string, version: number): void {
  if (payloadCache.size >= EDGE_MEMORY_MAX) {
    const oldest = payloadCache.keys().next().value;
    if (oldest) payloadCache.delete(oldest);
  }
  payloadCache.set(key, {
    body,
    version,
    expiresAt: Date.now() + EDGE_MEMORY_TTL_MS,
  });
}

export async function getKvPayloadCached(
  payloadKey: string,
  expectedVersion: number | null
): Promise<string | null> {
  if (!isEdgeKvEnabled()) return null;
  const raw = await edgeKvGet(`sf:p:${payloadKey}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { v: number; body: string };
    if (expectedVersion != null && parsed.v !== expectedVersion) return null;
    if (Date.now() > 0 && parsed.v < 1) return null;
    return parsed.body;
  } catch {
    return null;
  }
}

export async function setKvPayloadCached(
  payloadKey: string,
  version: number,
  body: string
): Promise<void> {
  if (!isEdgeKvEnabled()) return;
  await edgeKvSet(
    `sf:p:${payloadKey}`,
    JSON.stringify({ v: version, body }),
    Math.ceil(EDGE_MEMORY_TTL_MS / 1000)
  );
}

/**
 * Resolve cached payload: L1 memory → L2 KV (when version known).
 * Returns null on full miss.
 */
export async function resolveCachedPayload(
  slug: string,
  kind: 'bundle' | 'page' | 'meta',
  cursor: string,
  category: string,
  search: string,
  limit: number
): Promise<ResolvedStorefrontPayload | null> {
  const version =
    getCachedVersion(slug) ?? (await getCachedVersionAsync(slug));
  if (version == null) return null;

  const payloadKey = buildPayloadKey(slug, version, kind, cursor, category, search, limit);
  const memoryHit = getMemoryCached(payloadKey, version);
  if (memoryHit) return { body: memoryHit, version, layer: 'L1' };

  const kvHit = await getKvPayloadCached(payloadKey, version);
  if (kvHit) {
    setMemoryCache(payloadKey, kvHit, version);
    return { body: kvHit, version, layer: 'KV' };
  }

  return null;
}

/** Singleflight — one origin fetch per coalesce key per isolate. */
export function coalesceStorefrontFetch(
  coalesceKey: string,
  fetchFn: () => Promise<{
    body: string;
    version: number;
    payloadKey: string;
    originRpc?: number;
    layer?: StorefrontCacheLayer;
  }>
): Promise<StorefrontFetchMeta> {
  const existing = inflightFetches.get(coalesceKey);
  if (existing) {
    return existing.then((result) => ({
      ...result,
      coalesced: true,
      originRpc: 0,
    }));
  }

  const promise = fetchFn()
    .then(({ body, version, payloadKey, originRpc = 1, layer = 'ORIGIN' }) => {
      if (originRpc > 0) {
        setCachedVersion(slugFromPayloadKey(payloadKey), version);
        setMemoryCache(payloadKey, body, version);
        void setKvPayloadCached(payloadKey, version, body);
      }
      return {
        body,
        version,
        layer,
        originRpc,
        coalesced: false,
      };
    })
    .finally(() => {
      inflightFetches.delete(coalesceKey);
    });

  inflightFetches.set(coalesceKey, promise);
  return promise;
}

function slugFromPayloadKey(payloadKey: string): string {
  return payloadKey.split(':')[0] ?? '';
}

/** Drop L1 entries for a slug (sync). */
export function purgeSlugFromMemory(slug: string): number {
  let removed = 0;
  for (const key of payloadCache.keys()) {
    if (key.startsWith(`${slug}:`)) {
      payloadCache.delete(key);
      removed++;
    }
  }
  for (const key of inflightFetches.keys()) {
    if (key.includes(`:${slug}:`) || key.startsWith(`coalesce:${slug}:`)) {
      inflightFetches.delete(key);
    }
  }
  versionCache.delete(slug);
  return removed;
}

/** L1 purge + shared KV version key removal (async, best-effort). */
export async function purgeSlugFromCaches(slug: string): Promise<number> {
  const removed = purgeSlugFromMemory(slug);
  if (isEdgeKvEnabled()) {
    await edgeKvDel(`sf:v:${slug}`);
  }
  return removed;
}

export function edgeCacheControlHeader(): string {
  return `public, max-age=${EDGE_HTTP_MAX_AGE_SECONDS}, stale-while-revalidate=${EDGE_HTTP_SWR_SECONDS}`;
}

/** Future CDN tag invalidation hook (Cloudflare Cache-Tag compatible). */
export function edgeCacheTagHeader(slug: string): string {
  return `storefront-${slug.trim().toLowerCase()}`;
}

export { isEdgeKvEnabled } from './distributedKv.ts';
