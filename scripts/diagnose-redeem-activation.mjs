import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

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
const code = process.argv[2] || 'BDY-8PPB-6BY5';

if (!url || !serviceKey) {
  console.error('Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const normalized = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
const codeHash = Array.from(new Uint8Array(hashBuffer))
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('');

const { data: codeRow, error: codeErr } = await admin
  .from('merchant_access_codes')
  .select('*')
  .eq('code_hash', codeHash)
  .maybeSingle();

console.log('code lookup', codeErr?.message || 'ok', codeRow?.status, codeRow?.auth_email);

if (!codeRow) process.exit(1);

const testEmail = `${crypto.randomUUID()}@access.slaash.internal`;
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email: testEmail,
  password: 'test-password-123456789012345678901234',
  email_confirm: true,
  user_metadata: {
    username: codeRow.username || 'store99999',
    store_name: codeRow.store_name || 'Test Store',
    lead_id: codeRow.lead_id,
    sales_assigned: true,
  },
});

if (createError) {
  console.error('createUser failed:', createError.message, createError);
  process.exit(1);
}

console.log('createUser ok:', created.user?.id);

const now = new Date().toISOString();
const end = new Date();
end.setMonth(end.getMonth() + (codeRow.duration_months || 6));

const { error: subError } = await admin.from('subscriptions').upsert(
  {
    user_id: created.user.id,
    plan_name: codeRow.plan_id,
    start_date: now,
    end_date: end.toISOString(),
    status: 'active',
    lead_id: codeRow.lead_id,
    converted_at: now,
  },
  { onConflict: 'user_id' }
);

if (subError) {
  console.error('subscription upsert failed:', subError.message, subError);
  await admin.auth.admin.deleteUser(created.user.id);
  process.exit(1);
}

console.log('subscription ok');
await admin.auth.admin.deleteUser(created.user.id);
console.log('cleaned up test user');
