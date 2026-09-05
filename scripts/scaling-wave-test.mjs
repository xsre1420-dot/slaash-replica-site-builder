#!/usr/bin/env node
/**
 * Progressive scaling wave — 200 → 500 → 1000 concurrent users with pressure audit.
 *
 * Usage:
 *   node scripts/scaling-wave-test.mjs --slug=bidaya-demo
 *   node scripts/scaling-wave-test.mjs --mode=production --levels=200,500,1000
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  })
);

const loadEnv = () => {
  const out = {};
  for (const name of ['.env', '.env.local']) {
    const path = join(process.cwd(), name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?\s*$/);
      if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, '');
    }
  }
  return out;
};

const env = { ...process.env, ...loadEnv() };
const url = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const levels = (args.levels || '200,500,1000')
  .split(',')
  .map((n) => Number(n.trim()))
  .filter(Boolean);

const mode = args.mode || 'production';
const duration = args.duration || '45';
const slug = args.slug || 'bidaya-demo';
const cooldownMs = Number(args.cooldown || 30_000);

const outDir = join(process.cwd(), 'supabase/benchmarks');
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = join(outDir, `scaling-wave-${mode}-${stamp}.json`);

async function pressureAudit() {
  if (!url || !serviceKey) return null;
  const res = await fetch(`${url}/rest/v1/rpc/platform_scaling_pressure_audit`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'x-connection-mode': 'pooler',
    },
    body: '{}',
  });
  if (!res.ok) return { error: await res.text() };
  return res.json();
}

function parseLoadTestOutput(stdout, targetUsers) {
  const lines = stdout.split('\n');
  const phaseLine =
    [...lines].reverse().find((l) => new RegExp(`\\b${targetUsers}\\s+${targetUsers}\\b`).test(l)) ||
    [...lines].reverse().find((l) => /^\d+ users/.test(l.trim())) ||
    lines.find((l) => l.includes('Req/s'));

  const errMatch = phaseLine?.match(/([\d.]+)%/g);
  const errRate = errMatch ? Number(errMatch[0].replace('%', '')) : null;

  const nums = phaseLine?.match(/\d+/g)?.map(Number) ?? [];
  const p50 = nums[4] ?? null;
  const p95 = nums[5] ?? null;
  const p99 = nums[6] ?? null;
  const rps = phaseLine?.match(/([\d.]+)\s+req\/s/i)?.[1];

  return {
    summaryLine: phaseLine?.trim() ?? null,
    errorRate: errRate,
    p50,
    p95,
    p99,
    rps: rps ? Number(rps) : null,
  };
}

const report = {
  started_at: new Date().toISOString(),
  mode,
  slug,
  levels,
  steps: [],
};

console.log(`\nScaling wave — mode=${mode} slug=${slug} levels=${levels.join(' → ')}\n`);

for (let i = 0; i < levels.length; i += 1) {
  const users = levels[i];
  console.log(`\n▶ Wave ${i + 1}/${levels.length}: ${users} concurrent users (${duration}s)`);

  const before = await pressureAudit();

  const result = spawnSync(
    process.execPath,
    [
      'scripts/load-test.mjs',
      `--users=${users}`,
      `--duration=${duration}`,
      `--slug=${slug}`,
      `--mode=${mode}`,
      '--pooler=on',
      '--gate=6',
      '--timeout=12000',
    ],
    { cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe' }
  );

  console.log(result.stdout || '');
  if (result.stderr) console.error(result.stderr);

  const metrics = parseLoadTestOutput(result.stdout || '', users);
  const after = await pressureAudit();

  const step = {
    users,
    metrics,
    pressure_before: before,
    pressure_after: after,
    exit_code: result.status,
  };
  report.steps.push(step);

  const err = metrics.errorRate ?? 100;
  const stable = err <= 10 && (metrics.p95 ?? 99999) <= 8000;

  console.log(
    `  Result: err=${err}% p95=${metrics.p95 ?? '?'}ms rps=${metrics.rps ?? '?'} stable=${stable}`
  );

  if (!stable && users >= 200) {
    console.log('\n⚠ Stability threshold exceeded — stopping ladder.');
    report.stopped_reason = `unstable_at_${users}`;
    break;
  }

  if (i < levels.length - 1) {
    console.log(`\n⏳ Cooldown ${Math.round(cooldownMs / 1000)}s…`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, cooldownMs);
  }
}

report.finished_at = new Date().toISOString();
writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log(`\nSaved ${reportPath}`);

const lastStable = [...report.steps].reverse().find((s) => (s.metrics.errorRate ?? 100) <= 10);
console.log(
  `\nLast stable level: ~${lastStable?.users ?? 0} concurrent users (err ≤10%, p95 ≤8s)\n`
);

process.exit(report.stopped_reason ? 1 : 0);
