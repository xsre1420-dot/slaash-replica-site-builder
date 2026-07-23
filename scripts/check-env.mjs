#!/usr/bin/env node
/**
 * Validates required Vite env vars before production builds.
 * CI sets CI=true — local builds use ENV_STRICT=true to enforce.
 */

const REQUIRED = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];
const PLACEHOLDER_PATTERNS = [
  /^your-/i,
  /^placeholder/i,
  /^changeme/i,
  /^example/i,
  /^xxx+$/i,
];

const INFRA_OPTIONAL = [
  {
    key: 'VITE_SUPABASE_READ_REPLICA_URL',
    label: 'Read replica',
    benefit: 'Offloads storefront/analytics reads from primary',
  },
  {
    key: 'VITE_STOREFRONT_EDGE_URL',
    label: 'Edge storefront',
    benefit: 'CDN-cacheable storefront bundle via get-store-products',
  },
  {
    key: 'VITE_STOREFRONT_EDGE_ENABLED',
    label: 'Edge flag',
    benefit: 'Explicit edge toggle (auto-enabled when EDGE_URL is set)',
  },
  {
    key: 'VITE_CDN_BASE_URL',
    label: 'CDN media',
    benefit: 'Optimized image URLs with Supabase Storage fallback',
  },
  {
    key: 'VITE_KV_REST_URL',
    label: 'L2 KV cache',
    benefit: 'Cross-tab cache coherence (requires VITE_KV_REST_TOKEN)',
  },
  {
    key: 'VITE_SUPABASE_POOLER_URL',
    label: 'Connection pooler',
    benefit: 'Supavisor-compatible pooler header on RPC transport',
  },
  {
    key: 'VITE_FAILOVER_SUPABASE_URL',
    label: 'DR failover',
    benefit: 'Session-scoped primary URL swap on outage',
  },
];

const strict = process.env.CI === 'true' || process.env.ENV_STRICT === 'true';
const mode = process.env.NODE_ENV || process.env.MODE || 'production';

if (!strict && mode !== 'production') {
  console.log('[check-env] Skipped (set ENV_STRICT=true or CI=true to enforce)');
  process.exit(0);
}

const missing = [];
const invalid = [];

for (const key of REQUIRED) {
  const value = process.env[key]?.trim();
  if (!value) {
    missing.push(key);
    continue;
  }
  if (PLACEHOLDER_PATTERNS.some((p) => p.test(value))) {
    invalid.push(`${key} still has placeholder value`);
  }
  if (key === 'VITE_SUPABASE_URL') {
    try {
      const url = new URL(value);
      if (!url.hostname.includes('supabase')) {
        invalid.push(`${key} hostname does not look like Supabase`);
      }
    } catch {
      invalid.push(`${key} is not a valid URL`);
    }
  }
}

if (missing.length || invalid.length) {
  console.error('[check-env] Environment validation failed');
  missing.forEach((k) => console.error(`  Missing: ${k}`));
  invalid.forEach((m) => console.error(`  Invalid: ${m}`));
  console.error('\nCopy .env.example to .env and configure Supabase credentials.');
  process.exit(1);
}

const infraHints = [];
for (const item of INFRA_OPTIONAL) {
  const value = process.env[item.key]?.trim();
  if (!value || PLACEHOLDER_PATTERNS.some((p) => p.test(value))) {
    infraHints.push(`  ○ ${item.label} (${item.key}) — ${item.benefit}`);
  }
}

if (infraHints.length) {
  console.log('[check-env] Optional infrastructure (not configured):');
  infraHints.forEach((line) => console.log(line));
}

console.log('[check-env] OK');
