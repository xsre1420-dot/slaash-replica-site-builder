#!/usr/bin/env node
/** Isolated latency probe for regression investigation */
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
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const slug = process.argv.find((a) => a.startsWith('--slug='))?.split('=')[1] || 'bidaya-demo';

const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.ceil((p / 100) * sorted.length) - 1] ?? 0;
};

async function rpc(fn, body) {
  const t0 = performance.now();
  const res = await fetch(`${baseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const elapsed = performance.now() - t0;
  await res.text();
  return { fn, ok: res.ok, elapsed: Math.round(elapsed) };
}

async function loadTest(fn, body, users, sec) {
  const lat = [];
  const end = Date.now() + sec * 1000;
  await Promise.all(
    Array.from({ length: users }, async () => {
      while (Date.now() < end) {
        const r = await rpc(fn, body);
        lat.push(r.elapsed);
        await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 70));
      }
    })
  );
  return {
    fn,
    users,
    requests: lat.length,
    p50: Math.round(percentile(lat, 50)),
    p95: Math.round(percentile(lat, 95)),
    max: lat.length ? Math.max(...lat) : 0,
  };
}

async function main() {
  if (!baseUrl || !key) {
    console.error('Missing env');
    process.exit(1);
  }

  console.log(`Regression probe (slug=${slug})\n`);

  const bundleBody = { p_slug: slug, p_limit: 24, p_cursor: '', p_category: '', p_search: '' };
  const visitBody = { p_store_slug: slug, p_page_path: `/store/${slug}`, p_user_agent: 'RegressionProbe/1' };

  const singles = [];
  for (let i = 0; i < 10; i++) {
    singles.push(await rpc('get_storefront_page_bundle', bundleBody));
    singles.push(await rpc('track_store_visit_by_slug', visitBody));
  }

  const bundleSingles = singles.filter((x) => x.fn.includes('bundle')).map((x) => x.elapsed);
  const visitSingles = singles.filter((x) => x.fn.includes('visit')).map((x) => x.elapsed);
  console.log('Single-thread (10 each):');
  console.log(`  bundle p50=${percentile(bundleSingles, 50)}ms p95=${percentile(bundleSingles, 95)}ms`);
  console.log(`  visit  p50=${percentile(visitSingles, 50)}ms p95=${percentile(visitSingles, 95)}ms\n`);

  for (const users of [25, 50, 100]) {
    const [b, v] = await Promise.all([
      loadTest('get_storefront_page_bundle', bundleBody, users, 8),
      loadTest('track_store_visit_by_slug', visitBody, users, 8),
    ]);
    console.log(`${users} concurrent / 8s:`);
    console.log(`  bundle: ${b.requests} req p50=${b.p50}ms p95=${b.p95}ms max=${b.max}ms`);
    console.log(`  visit:  ${v.requests} req p50=${v.p50}ms p95=${v.p95}ms max=${v.max}ms`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
