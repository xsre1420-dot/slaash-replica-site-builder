#!/usr/bin/env node
/**
 * Storage integrity audit — lists bucket objects vs DB references.
 * Requires SUPABASE_SERVICE_ROLE_KEY (or runs reference-only dry report).
 *
 * Usage:
 *   node scripts/storage-audit.mjs
 *   node scripts/storage-audit.mjs --owner=<uuid>
 *   node scripts/storage-audit.mjs --json
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const BUCKET = 'product-images';
const LARGE_BYTES = 500 * 1024;

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
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const ownerFilter = process.argv.find((a) => a.startsWith('--owner='))?.split('=')[1];
const jsonOut = process.argv.includes('--json');

const headers = (key) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
});

const parseStoragePath = (publicUrl) => {
  if (!publicUrl || typeof publicUrl !== 'string') return null;
  try {
    const u = new URL(publicUrl.trim());
    const marker = `/object/public/${BUCKET}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
};

const thumbPathFor = (objectPath) => {
  const m = objectPath.match(/^([^/]+)\/([0-9a-f-]{36}\.(webp|jpg|jpeg|png))$/i);
  return m ? `${m[1]}/thumbs/${m[2]}` : null;
};

const pathsFromUrls = (urls) => {
  const paths = new Set();
  for (const raw of urls) {
    const p = parseStoragePath(raw);
    if (!p) continue;
    paths.add(p);
    const thumb = thumbPathFor(p);
    if (thumb) paths.add(thumb);
  }
  return paths;
};

async function fetchAllRows(table, select, key) {
  const rows = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const q = `select=${encodeURIComponent(select)}&limit=${limit}&offset=${offset}`;
    const res = await fetch(`${url}/rest/v1/${table}?${q}`, { headers: headers(key) });
    if (!res.ok) throw new Error(`${table} fetch failed: ${res.status} ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return rows;
}

async function listBucketObjects(key, prefix = '') {
  const objects = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const body = { prefix, limit, offset, sortBy: { column: 'name', order: 'asc' } };
    const res = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: headers(key),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`storage list failed: ${res.status} ${await res.text()}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const item of batch) {
      const name = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) {
        objects.push({
          name,
          size: item.metadata?.size ?? item.metadata?.contentLength ?? 0,
        });
      } else if (item.name && !item.name.includes('.')) {
        const nested = await listBucketObjects(key, name);
        objects.push(...nested);
      }
    }
    if (batch.length < limit) break;
    offset += limit;
  }
  return objects;
}

async function main() {
  if (!url) {
    console.error('Missing VITE_SUPABASE_URL');
    process.exit(1);
  }

  const report = {
    bucket: BUCKET,
    ownerFilter: ownerFilter || null,
    referencedUrls: 0,
    referencedPaths: 0,
    bucketObjects: 0,
    orphanPaths: [],
    brokenReferences: [],
    duplicateReferences: [],
    largeObjects: [],
    externalImageUrls: 0,
    scannedAt: new Date().toISOString(),
  };

  if (!serviceKey) {
    console.warn('⚠ SUPABASE_SERVICE_ROLE_KEY missing — DB reference scan skipped');
    if (jsonOut) console.log(JSON.stringify(report, null, 2));
    else console.log('Set SUPABASE_SERVICE_ROLE_KEY in .env for full audit.');
    process.exit(0);
  }

  const products = await fetchAllRows('products', 'owner_id,image_url,additional_images', serviceKey);
  const stores = await fetchAllRows('store_settings', 'owner_id,store_logo,banner_images', serviceKey);

  const referencedUrls = [];
  const urlCounts = new Map();
  const brokenReferences = [];

  const trackUrl = (raw, source) => {
    if (!raw?.trim()) return;
    const trimmed = raw.trim();
    referencedUrls.push(trimmed);
    urlCounts.set(trimmed, (urlCounts.get(trimmed) || 0) + 1);
    if (!parseStoragePath(trimmed) && trimmed.startsWith('http')) {
      brokenReferences.push({ source, url: trimmed.slice(0, 120), reason: 'external_or_non_storage_url' });
    }
    if (trimmed.startsWith('blob:')) {
      brokenReferences.push({ source, url: trimmed.slice(0, 80), reason: 'blob_url_in_db' });
    }
  };

  for (const row of products) {
    if (ownerFilter && row.owner_id !== ownerFilter) continue;
    trackUrl(row.image_url, `product:${row.owner_id}:main`);
    for (const u of row.additional_images || []) trackUrl(u, `product:${row.owner_id}:additional`);
  }

  for (const row of stores) {
    if (ownerFilter && row.owner_id !== ownerFilter) continue;
    trackUrl(row.store_logo, `store:${row.owner_id}:logo`);
    for (const u of row.banner_images || []) trackUrl(u, `store:${row.owner_id}:banner`);
  }

  report.referencedUrls = referencedUrls.length;
  report.duplicateReferences = [...urlCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([url, count]) => ({ url, count }));
  report.brokenReferences = brokenReferences;
  report.externalImageUrls = brokenReferences.filter((b) => b.reason === 'external_or_non_storage_url').length;

  const referencedPaths = pathsFromUrls(referencedUrls);
  report.referencedPaths = referencedPaths.size;

  let objects = await listBucketObjects(serviceKey, ownerFilter || '');
  if (ownerFilter) {
    objects = objects.filter((o) => o.name.startsWith(`${ownerFilter}/`));
  }
  report.bucketObjects = objects.length;

  const objectNames = new Set(objects.map((o) => o.name));
  report.orphanPaths = objects
    .map((o) => o.name)
    .filter((name) => !referencedPaths.has(name))
    .slice(0, 200);

  report.largeObjects = objects
    .filter((o) => Number(o.size) >= LARGE_BYTES)
    .sort((a, b) => Number(b.size) - Number(a.size))
    .slice(0, 50)
    .map((o) => ({ path: o.name, sizeKb: Math.round(Number(o.size) / 1024) }));

  const orphanBytes = objects
    .filter((o) => report.orphanPaths.includes(o.name))
    .reduce((sum, o) => sum + Number(o.size || 0), 0);

  report.orphanSummary = {
    count: report.orphanPaths.length,
    estimatedWasteMb: Math.round((orphanBytes / (1024 * 1024)) * 10) / 10,
  };

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('\n=== Storage Audit Report ===\n');
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Referenced URLs: ${report.referencedUrls}`);
  console.log(`Referenced object paths (incl. thumbs): ${report.referencedPaths}`);
  console.log(`Bucket objects: ${report.bucketObjects}`);
  console.log(`Orphan paths (sample max 200): ${report.orphanSummary.count}`);
  console.log(`Estimated orphan waste: ~${report.orphanSummary.estimatedWasteMb} MB`);
  console.log(`Duplicate URL references: ${report.duplicateReferences.length}`);
  console.log(`Broken / external DB references: ${report.brokenReferences.length}`);
  console.log(`Large objects (>=500KB): ${report.largeObjects.length}`);

  if (report.orphanPaths.length > 0) {
    console.log('\nOrphan sample:');
    report.orphanPaths.slice(0, 10).forEach((p) => console.log(`  - ${p}`));
  }

  if (report.largeObjects.length > 0) {
    console.log('\nLargest files:');
    report.largeObjects.slice(0, 5).forEach((o) => console.log(`  - ${o.path} (${o.sizeKb} KB)`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
