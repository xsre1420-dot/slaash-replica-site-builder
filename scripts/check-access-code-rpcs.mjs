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
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing Supabase env');
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
};

const fns = [
  ['admin_replace_lead_access_code', { p_lead_id: '00000000-0000-0000-0000-000000000001' }],
  ['admin_revoke_lead_access_code', { p_lead_id: '00000000-0000-0000-0000-000000000001' }],
  ['admin_generate_access_code', { p_lead_id: '00000000-0000-0000-0000-000000000001' }],
];

for (const [fn, body] of fns) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`\n${fn}:`);
  console.log(`  HTTP ${res.status}`);
  console.log(`  ${text.slice(0, 300)}`);
}
