/**
 * Optional shared KV for edge isolates (Upstash Redis REST compatible).
 */
const KV_URL = Deno.env.get('UPSTASH_REDIS_REST_URL') ?? Deno.env.get('KV_REST_URL') ?? '';
const KV_TOKEN = Deno.env.get('UPSTASH_REDIS_REST_TOKEN') ?? Deno.env.get('KV_REST_TOKEN') ?? '';

export function isEdgeKvEnabled(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

export async function edgeKvGet(key: string): Promise<string | null> {
  if (!isEdgeKvEnabled()) return null;
  try {
    const res = await fetch(`${KV_URL.replace(/\/$/, '')}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.result ?? null;
  } catch {
    return null;
  }
}

export async function edgeKvSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (!isEdgeKvEnabled()) return;
  const ttl = Math.max(1, ttlSeconds);
  try {
    await fetch(
      `${KV_URL.replace(/\/$/, '')}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?EX=${ttl}`,
      { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } }
    );
  } catch {
    /* best effort */
  }
}

export async function edgeKvDel(key: string): Promise<void> {
  if (!isEdgeKvEnabled()) return;
  try {
    await fetch(`${KV_URL.replace(/\/$/, '')}/del/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
  } catch {
    /* best effort */
  }
}
