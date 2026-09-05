#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';

const loadEnv = () => {
  const out = {};
  for (const name of ['.env', '.env.local']) {
    if (!existsSync(name)) continue;
    for (const line of readFileSync(name, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?\s*$/);
      if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, '');
    }
  }
  return out;
};

const env = loadEnv();
const base = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const url = `${base}/functions/v1/get-store-products?slug=bidaya-demo&bundle=1&limit=24`;
const origins = [
  env.CAPACITY_PROBE_ORIGIN,
  env.VITE_PUBLIC_APP_URL,
  ...(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  'https://localhost:5173',
  null,
];

for (const origin of origins) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'X-Slaash-Capacity-Probe': '1',
    'x-connection-mode': 'pooler',
  };
  if (origin) headers.Origin = origin;
  const res = await fetch(url, { headers });
  const text = await res.text();
  console.log(
    JSON.stringify({
      origin: origin || '(none)',
      status: res.status,
      cache: res.headers.get('x-cache'),
      layer: res.headers.get('x-slaash-cache-layer'),
      ok: res.ok,
      body: text.slice(0, 150),
    })
  );
}
