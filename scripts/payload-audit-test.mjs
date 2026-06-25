#!/usr/bin/env node
/**
 * Storefront bundle payload audit — measures live RPC response sizes.
 * Usage: node scripts/payload-audit-test.mjs [--slug=demo]
 */
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

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  })
);

const slug = args.slug && args.slug !== 'true' ? args.slug : null;

const tests = [];
const read = (rel) => (existsSync(join(process.cwd(), rel)) ? readFileSync(join(process.cwd(), rel), 'utf8') : '');

const migration = read('supabase/migrations/20260625000057_storefront_payload_optimization.sql');

tests.push({
  name: 'v57 migration: storefront_product_grid_json',
  pass: migration.includes('storefront_product_grid_json'),
});
tests.push({
  name: 'v57 migration: slim store shell (no policies in bundle)',
  pass: migration.includes('storefront_store_shell_json') && migration.includes('get_store_policies'),
});
tests.push({
  name: 'v57 migration: bundle uses grid JSON not full JSON',
  pass: migration.includes('storefront_product_grid_json(p) AS pj'),
});
tests.push({
  name: 'client lazy policy fetch',
  pass:
    read('src/services/storefrontProductService.ts').includes('fetchStorePolicies') &&
    read('src/lib/tenantStoreRegistry.ts').includes('schedulePolicyHydration'),
});
tests.push({
  name: 'payload audit reports present',
  pass:
    existsSync(join(process.cwd(), 'supabase/STOREFRONT_PAYLOAD_AUDIT_REPORT.md')) &&
    existsSync(join(process.cwd(), 'supabase/STOREFRONT_RPC_COST_REPORT.md')),
});

const kb = (bytes) => (bytes / 1024).toFixed(2);

async function rpc(fn, body) {
  const started = performance.now();
  const res = await fetch(`${baseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, text, elapsed: performance.now() - started, status: res.status };
}

let liveMetrics = null;

if (baseUrl && anonKey && slug) {
  try {
    const bundle = await rpc('get_storefront_page_bundle', {
      p_slug: slug,
      p_limit: 24,
      p_cursor: '',
      p_category: '',
      p_search: '',
    });
    if (bundle.ok) {
      const data = JSON.parse(bundle.text);
      const products = data.products || [];
      const storeBytes = new TextEncoder().encode(JSON.stringify(data.store || {})).length;
      const categoriesBytes = new TextEncoder().encode(JSON.stringify(data.categories || [])).length;
      const productsBytes = new TextEncoder().encode(JSON.stringify(products)).length;
      const totalBytes = bundle.text.length;
      const avgProduct = products.length ? productsBytes / products.length : 0;

      liveMetrics = {
        slug,
        totalKb: kb(totalBytes),
        storeKb: kb(storeBytes),
        categoriesKb: kb(categoriesBytes),
        productsKb: kb(productsBytes),
        productCount: products.length,
        avgProductBytes: Math.round(avgProduct),
        elapsedMs: bundle.elapsed.toFixed(0),
        hasAdditionalImages: products.some((p) => p?.additional_images?.length > 0),
        hasFullDescription: products.some((p) => (p?.description || '').length > 120),
        gridOptimized: !products.some((p) => p?.additional_images?.length > 0),
      };

      tests.push({
        name: `live bundle total < 35 KB (24 products)`,
        pass: totalBytes < 35 * 1024,
      });
      tests.push({
        name: 'live bundle: no additional_images in grid',
        pass: !liveMetrics.hasAdditionalImages,
      });
      tests.push({
        name: 'live bundle: avg product < 900 bytes',
        pass: avgProduct < 900,
      });
    } else {
      tests.push({ name: 'live bundle RPC reachable', pass: false });
    }
  } catch {
    tests.push({ name: 'live bundle RPC reachable', pass: false });
  }
} else {
  console.log('(Skipping live RPC size probes — set .env and --slug=YOUR_SLUG)\n');
}

const passed = tests.filter((t) => t.pass).length;
console.log('\nStorefront payload audit validation\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
if (liveMetrics) {
  console.log('\n── Live bundle metrics ──');
  console.log(`Slug:           ${liveMetrics.slug}`);
  console.log(`Total:          ${liveMetrics.totalKb} KB`);
  console.log(`Store:          ${liveMetrics.storeKb} KB`);
  console.log(`Categories:     ${liveMetrics.categoriesKb} KB`);
  console.log(`Products (${liveMetrics.productCount}):     ${liveMetrics.productsKb} KB`);
  console.log(`Avg/product:    ${liveMetrics.avgProductBytes} B`);
  console.log(`RPC time:       ${liveMetrics.elapsedMs} ms`);
  console.log(`Grid optimized: ${liveMetrics.gridOptimized ? 'yes' : 'no (deploy v57)'}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
