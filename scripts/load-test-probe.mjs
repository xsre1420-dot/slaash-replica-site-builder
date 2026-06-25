#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const loadEnv = () => {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?\s*$/);
    if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
  return out;
};

const env = { ...process.env, ...loadEnv() };
const baseUrl = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const slug = process.argv.find((a) => a.startsWith('--slug='))?.split('=')[1] || 'bidaya-demo';

const rpcs = [
  ['get_store_meta', { p_slug: slug }],
  ['list_public_store_slugs', { p_limit: 20, p_offset: 0 }],
  [
    'get_store_products_page',
    { p_slug: slug, p_limit: 24, p_cursor: '', p_category: '', p_search: '' },
  ],
  [
    'get_storefront_page_bundle',
    { p_slug: slug, p_limit: 24, p_cursor: '', p_category: '', p_search: '' },
  ],
  [
    'track_store_visit_by_slug',
    { p_store_slug: slug, p_page_path: `/store/${slug}`, p_user_agent: 'SlaashLoadTest/probe' },
  ],
  ['get_store_products_by_slug', { p_slug: slug }],
];

const edgeFns = [
  ['get-store-products', { slug, limit: 24 }],
];

console.log('Base URL:', baseUrl);
console.log('Slug:', slug);
console.log('');

for (const [fn, body] of rpcs) {
  const url = `${baseUrl}/rest/v1/rpc/${fn}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log('RPC:', fn);
  console.log('  URL:', url);
  console.log('  Status:', res.status);
  console.log('  Body:', text.slice(0, 500));
  console.log('');
}

for (const [fn, params] of edgeFns) {
  const url = `${baseUrl}/functions/v1/${fn}?slug=${encodeURIComponent(params.slug)}&limit=${params.limit}`;
  const res = await fetch(url, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  const text = await res.text();
  console.log('Edge:', fn);
  console.log('  URL:', url);
  console.log('  Status:', res.status);
  console.log('  Body:', text.slice(0, 500));
  console.log('');
}
