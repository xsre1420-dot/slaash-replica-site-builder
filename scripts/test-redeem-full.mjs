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
const code = process.argv[2];

if (!url || !key || !code) {
  console.error('Usage: node scripts/test-redeem-full.mjs BDY-XXXX-XXXX');
  process.exit(1);
}

const res = await fetch(`${url}/functions/v1/redeem-access-code`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Origin: 'http://localhost:8080',
  },
  body: JSON.stringify({ code }),
});

console.log('HTTP', res.status);
const text = await res.text();
console.log(text.slice(0, 2000));
