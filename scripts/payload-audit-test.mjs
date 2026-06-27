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

const migrationV76 = read('supabase/migrations/20260626000005_payload_optimization_phase_1_6.sql');
const migrationV57 = read('supabase/migrations/20260625000057_storefront_payload_optimization.sql');

tests.push({
  name: 'v76 migration: storefront_product_list_json',
  pass: migrationV76.includes('storefront_product_list_json'),
});
tests.push({
  name: 'v76 migration: bundle hero + featured',
  pass: migrationV76.includes('storefront_store_hero_json') && migrationV76.includes("'featured'"),
});
tests.push({
  name: 'v76 migration: slim bootstrap (product_count not products array)',
  pass: migrationV76.includes("'product_count'") && !migrationV76.includes("'products', COALESCE(("),
});
tests.push({
  name: 'v76 migration: dashboard split RPCs',
  pass: migrationV76.includes('get_dashboard_kpis_light') && migrationV76.includes('get_dashboard_workflow_counts'),
});
tests.push({
  name: 'v76 migration: platform_payload_benchmark',
  pass: migrationV76.includes('platform_payload_benchmark'),
});
tests.push({
  name: 'v57 migration: bundle uses grid JSON not full JSON',
  pass: migrationV57.includes('storefront_product_grid_json(p) AS pj'),
});
tests.push({
  name: 'client slim product mapper',
  pass: read('src/mappers/productMapper.ts').includes('stock_status') && read('src/mappers/productMapper.ts').includes('thumbnail'),
});
tests.push({
  name: 'client bootstrap no product array cache',
  pass: read('src/services/storeService.ts').includes('product_count') && !read('src/services/storeService.ts').includes('data.products'),
});
tests.push({
  name: 'coupon list explicit select',
  pass: read('src/services/couponService.ts').includes('COUPON_LIST_SELECT'),
});
tests.push({
  name: 'payload benchmark script present',
  pass: existsSync(join(process.cwd(), 'scripts/payload-benchmark.mjs')),
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

if (baseUrl && anonKey) {
  try {
    let activeSlug = slug;
    if (!activeSlug) {
      const slugsRes = await rpc('list_public_store_slugs', { p_limit: 10 });
      if (slugsRes.ok) {
        const slugs = JSON.parse(slugsRes.text);
        activeSlug = slugs?.find((s) => s?.store_slug)?.store_slug ?? null;
      }
    }

    if (!activeSlug) {
      console.log('(Skipping live RPC — no slug; pass --slug=YOUR_SLUG)\n');
    } else {
    const bundle = await rpc('get_storefront_page_bundle', {
      p_slug: activeSlug,
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
        slug: activeSlug,
        totalKb: kb(totalBytes),
        storeKb: kb(storeBytes),
        categoriesKb: kb(categoriesBytes),
        productsKb: kb(productsBytes),
        productCount: products.length,
        avgProductBytes: Math.round(avgProduct),
        elapsedMs: bundle.elapsed.toFixed(0),
        hasDescription: products.some((p) => (p?.description || '').length > 0),
        hasVariants: products.some((p) => p?.variants?.length > 0 || p?.sizes?.length > 0),
        hasSlimFields: products.some((p) => p?.thumbnail != null || p?.stock_status != null),
        hasHero: data.hero != null,
        hasFeatured: Array.isArray(data.featured) && data.featured.length > 0,
      };

      tests.push({
        name: 'live bundle total < 30 KB (24 products)',
        pass: totalBytes < 30 * 1024,
      });
      tests.push({
        name: 'live bundle: no description in grid',
        pass: !liveMetrics.hasDescription,
      });
      tests.push({
        name: 'live bundle: no variants/sizes in grid',
        pass: !liveMetrics.hasVariants,
      });
      tests.push({
        name: 'live bundle: avg product < 550 bytes',
        pass: avgProduct < 550,
      });
      tests.push({
        name: 'live bundle: slim list fields present',
        pass: liveMetrics.hasSlimFields,
      });
    } else {
      tests.push({ name: 'live bundle RPC reachable', pass: false });
    }
    }
  } catch {
    tests.push({ name: 'live bundle RPC reachable', pass: false });
  }
} else {
  console.log('(Skipping live RPC size probes — set .env)\n');
}

const passed = tests.filter((t) => t.pass).length;
console.log('\nPayload optimization validation (Phase 1.6)\n');
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
  console.log(`Slim fields:    ${liveMetrics.hasSlimFields ? 'yes' : 'no'}`);
  console.log(`Hero/featured:  ${liveMetrics.hasHero ? 'hero' : '-'} / ${liveMetrics.hasFeatured ? 'featured' : '-'}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
