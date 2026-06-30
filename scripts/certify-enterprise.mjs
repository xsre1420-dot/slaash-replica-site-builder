#!/usr/bin/env node
/**
 * Run enterprise certification audit suite (v96).
 * Executes static audits; does not require live database.
 */
import { execSync } from 'child_process';
import { join } from 'path';

const ROOT = process.cwd();

const AUDITS = [
  'audit:enterprise-final',
  'audit:security-certification',
  'audit:supabase-security',
  'audit:security-hardening',
  'audit:finops-scaling',
  'audit:infrastructure-cost',
  'audit:disaster-recovery',
  'audit:enterprise-alerting',
  'security:scan-secrets',
];

const results = [];

console.log('\n=== Enterprise Certification Suite (v96) ===\n');

for (const script of AUDITS) {
  try {
    execSync(`npm run ${script}`, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
    results.push({ script, pass: true });
    console.log(`✓ ${script}`);
  } catch (err) {
    const msg = err.stderr?.slice(-200) || err.message;
    results.push({ script, pass: false, error: msg });
    console.log(`✗ ${script}`);
  }
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} audits passed\n`);

process.exit(passed === results.length ? 0 : 1);
