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
const code = process.argv[2] || 'BDY-TEST-INVALID';
const preview = process.argv.includes('--preview');

if (!url || !key) {
  console.error('Missing Supabase env');
  process.exit(1);
}

const origins = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:5173',
  null,
];

for (const origin of origins) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (origin) headers.Origin = origin;

  const res = await fetch(`${url}/functions/v1/redeem-access-code`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code, preview: preview || code !== 'BDY-TEST-INVALID' }),
  });
  const text = await res.text();
  console.log(`\nOrigin: ${origin ?? '(none)'}`);
  console.log(`HTTP ${res.status}`);
  console.log(text.slice(0, 500));
}
