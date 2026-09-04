/**
 * Optional L2 cache via Upstash Redis REST API (or compatible KV).
 * Enables cross-tab / cross-instance cache coherence when configured.
 */
import { env } from '@/lib/env';

type KvEntry = { value: string; expiresAt: number };

const localKvFallback = new Map<string, KvEntry>();

function kvConfigured(): boolean {
  const hasCredentials = Boolean(env.VITE_KV_REST_URL?.trim() && env.VITE_KV_REST_TOKEN?.trim());
  if (!hasCredentials) return false;
  // Production browser bundles must not ship Upstash write tokens unless explicitly opted in.
  // Edge functions use UPSTASH_REDIS_REST_* secrets (see supabase/functions/_shared/distributedKv.ts).
  if (env.VITE_APP_ENV === 'production' && env.VITE_KV_BROWSER_ENABLED !== 'true') {
    return false;
  }
  return true;
}

async function kvFetch(path: string, init?: RequestInit): Promise<Response | null> {
  if (!kvConfigured()) return null;
  const base = env.VITE_KV_REST_URL!.replace(/\/$/, '');
  const token = env.VITE_KV_REST_TOKEN!;
  try {
    return await fetch(`${base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    return null;
  }
}

export async function kvGet(key: string): Promise<string | null> {
  const res = await kvFetch(`/get/${encodeURIComponent(key)}`);
  if (res?.ok) {
    const json = (await res.json()) as { result?: string | null };
    return json.result ?? null;
  }

  const hit = localKvFallback.get(key);
  if (!hit || Date.now() > hit.expiresAt) {
    localKvFallback.delete(key);
    return null;
  }
  return hit.value;
}

export async function kvSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const ttl = Math.max(1, ttlSeconds);
  const res = await kvFetch(`/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?EX=${ttl}`, {
    method: 'POST',
  });
  if (res?.ok) return;

  localKvFallback.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
}

export async function kvDel(key: string): Promise<void> {
  await kvFetch(`/del/${encodeURIComponent(key)}`, { method: 'POST' });
  localKvFallback.delete(key);
}

export async function kvFlushPrefix(prefix: string): Promise<void> {
  if (!kvConfigured()) {
    for (const k of localKvFallback.keys()) {
      if (k.startsWith(prefix)) localKvFallback.delete(k);
    }
    return;
  }

  const res = await kvFetch(`/keys/${encodeURIComponent(`${prefix}*`)}`);
  if (!res?.ok) return;
  const json = (await res.json()) as { result?: string[] };
  const keys = json.result ?? [];
  await Promise.all(keys.map((k) => kvDel(k)));
}

export function isKvCacheEnabled(): boolean {
  return kvConfigured();
}
