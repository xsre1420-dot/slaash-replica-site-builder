/**
 * Version-aware in-memory cache for Supabase Edge Functions.
 * Payload entries are keyed by slug + cache_version so catalog bumps invalidate instantly.
 * Optional L2: UPSTASH_REDIS_REST_URL for cross-isolate version coherence.
 */
import { edgeKvGet, edgeKvSet, isEdgeKvEnabled } from './distributedKv.ts';

const EDGE_MEMORY_TTL_MS = 120_000;
const EDGE_VERSION_TTL_MS = 30_000;
const EDGE_MEMORY_MAX = 2_000;
const EDGE_VERSION_MAX = 5_000;

type PayloadEntry = { body: string; version: number; expiresAt: number };
type VersionEntry = { version: number; expiresAt: number };

const payloadCache = new Map<string, PayloadEntry>();
const versionCache = new Map<string, VersionEntry>();

export function edgeCacheStats(): {
  payloadEntries: number;
  versionEntries: number;
} {
  return {
    payloadEntries: payloadCache.size,
    versionEntries: versionCache.size,
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
    void edgeKvSet(`sf:v:${slug}`, String(version), Math.ceil(EDGE_VERSION_TTL_MS / 1000));
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

export function getMemoryCached(key: string, currentVersion: number): string | null {
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

/** Drop all payload entries for a slug (best-effort purge API). */
export function purgeSlugFromMemory(slug: string): number {
  let removed = 0;
  for (const key of payloadCache.keys()) {
    if (key.startsWith(`${slug}:`)) {
      payloadCache.delete(key);
      removed++;
    }
  }
  versionCache.delete(slug);
  return removed;
}

export const EDGE_HTTP_CACHE_SECONDS = 120;

export function edgeCacheControlHeader(): string {
  return `public, max-age=${EDGE_HTTP_CACHE_SECONDS}, stale-while-revalidate=180`;
}
