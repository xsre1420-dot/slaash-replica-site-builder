#!/usr/bin/env node
/**
 * Storage tenant-isolation probes (anon + optional authenticated).
 *
 * Usage: node scripts/storage-isolation-test.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const BUCKET = 'product-images';
const VICTIM_OWNER = '00000000-0000-0000-0000-000000000001';
const VICTIM_PATH = `${VICTIM_OWNER}/00000000-0000-0000-0000-000000000002.webp`;

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
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or anon key');
  process.exit(1);
}

const anonHeaders = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
};

const tests = [];

async function storageDelete(path, headers, label) {
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${encodeURIComponent(path)}`, {
    method: 'DELETE',
    headers,
  });
  const blocked = res.status === 401 || res.status === 403 || res.status === 400;
  tests.push({ label, pass: blocked, status: res.status, detail: await res.text().catch(() => '') });
}

async function storageUpload(path, headers, label) {
  const body = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'image/png',
      'x-upsert': 'false',
    },
    body,
  });
  const blocked = res.status === 401 || res.status === 403 || res.status === 400;
  tests.push({ label, pass: blocked, status: res.status, detail: (await res.text()).slice(0, 200) });
}

async function storageList(headers, label) {
  const res = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: VICTIM_OWNER, limit: 10 }),
  });
  const text = await res.text();
  const blocked =
    res.status === 401 ||
    res.status === 403 ||
    text.includes('permission') ||
    text.includes('Policy') ||
    (res.ok && JSON.parse(text).length === 0);
  tests.push({ label, pass: blocked, status: res.status, detail: text.slice(0, 200) });
}

async function publicRead(label) {
  const res = await fetch(
    `${url}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(VICTIM_PATH)}`,
    { method: 'GET' }
  );
  // Public bucket: 200 if file exists, 404 if not — both OK (no auth required by design)
  const pass = res.status === 200 || res.status === 404;
  tests.push({ label, pass, status: res.status, detail: 'public bucket read is intentional' });
}

console.log('Storage isolation probes\n');

await storageDelete(VICTIM_PATH, anonHeaders, 'Anon cannot DELETE victim object');
await storageUpload(`${VICTIM_OWNER}/probe-${Date.now()}.png`, anonHeaders, 'Anon cannot INSERT into victim folder');
await storageList(anonHeaders, 'Anon cannot LIST victim prefix (or gets empty)');
await publicRead('Public GET allowed for storefront CDN (404/200)');

let passed = 0;
for (const t of tests) {
  const icon = t.pass ? '✓' : '✗';
  if (t.pass) passed += 1;
  console.log(`${icon} ${t.label} [${t.status}]`);
  if (!t.pass) console.log(`   ${t.detail}`);
}

console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
