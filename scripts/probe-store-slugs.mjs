#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env');
const env = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}

const baseUrl = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const slug = process.argv[2] || 'bidaya-demo';

async function rpc(fn, body, headers = {}) {
  const res = await fetch(`${baseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

const meta = await rpc('get_store_meta', { p_slug: slug });
const bundle = await rpc('get_storefront_page_bundle', {
  p_slug: slug, p_limit: 24, p_cursor: '', p_category: '', p_search: '',
});
const page = await rpc('get_store_products_page', {
  p_slug: slug, p_limit: 24, p_cursor: '', p_category: '', p_search: '',
});

console.log('meta', meta.status, meta.data?.store?.store_name ?? meta.data);
console.log('bundle', bundle.status, bundle.data?.store?.store_name, 'products', bundle.data?.products?.length);
console.log('page', page.status, 'products', page.data?.products?.length);
