#!/usr/bin/env node
/**
 * Pre/post disaster recovery validation checklist.
 * Usage: node scripts/recovery-check.mjs [--url https://your-app.com]
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const appUrl = args.find((a) => a.startsWith('--url='))?.split('=')[1]
  || process.env.RECOVERY_CHECK_URL
  || 'http://localhost:8080';

const checks = [];
const pass = (name, detail = '') => checks.push({ name, ok: true, detail });
const fail = (name, detail = '') => checks.push({ name, ok: false, detail });

// 1. Migrations exist
const migDir = join(process.cwd(), 'supabase', 'migrations');
if (existsSync(migDir)) {
  const files = readdirSync(migDir).filter((f) => f.endsWith('.sql'));
  pass('migrations.present', `${files.length} migration files`);
} else {
  fail('migrations.present', 'supabase/migrations missing');
}

// 2. Backup scripts
for (const script of ['backup-database.sh', 'restore-database.sh']) {
  existsSync(join(process.cwd(), 'scripts', script))
    ? pass(`script.${script}`)
    : fail(`script.${script}`, 'missing');
}

// 3. DR module
existsSync(join(process.cwd(), 'src', 'lib', 'disasterRecovery', 'index.ts'))
  ? pass('dr.client_module')
  : fail('dr.client_module');

// 4. Health endpoint
try {
  const res = await fetch(`${appUrl.replace(/\/$/, '')}/health.json`, { signal: AbortSignal.timeout(8000) });
  if (res.ok) {
    const body = await res.json();
    pass('health.endpoint', JSON.stringify(body));
  } else {
    fail('health.endpoint', `HTTP ${res.status}`);
  }
} catch (e) {
  fail('health.endpoint', e instanceof Error ? e.message : String(e));
}

// 5. Env example documents failover
const envExample = readFileSync(join(process.cwd(), '.env.example'), 'utf8');
envExample.includes('FAILOVER') ? pass('env.failover_documented') : fail('env.failover_documented');

// 6. Tests exist
const testFiles = [];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) testFiles.push(p);
  }
};
walk(join(process.cwd(), 'src'));
walk(join(process.cwd(), 'e2e'));
testFiles.length > 0 ? pass('tests.present', `${testFiles.length} test files`) : fail('tests.present');

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
}

console.log(`\nRecovery check: ${checks.length - failed.length}/${checks.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);
