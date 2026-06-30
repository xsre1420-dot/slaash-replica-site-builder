#!/usr/bin/env node
/**
 * Scan source for leaked secrets — fail if hardcoded credentials found.
 */
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();

const SCAN_DIRS = ['src', 'supabase/functions'];
const SKIP_FILES = /\.(test|spec)\.(ts|tsx)$/;
const SKIP_PATHS = ['node_modules', '.git', 'dist', 'build'];

const PATTERNS = [
  { name: 'stripe_live_key', regex: /sk_live_[A-Za-z0-9]{16,}/ },
  { name: 'hardcoded_jwt', regex: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
  { name: 'vite_service_role', regex: /VITE_[A-Z_]*SERVICE_ROLE[A-Z_]*/ },
  { name: 'service_role_assignment', regex: /service_role_key\s*=\s*['"][^'"]{20,}['"]/i },
];

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (SKIP_PATHS.some((s) => p.includes(s))) continue;
    if (entry.isDirectory()) walk(p, files);
    else if (/\.(ts|tsx|js|mjs|jsx)$/.test(entry.name) && !SKIP_FILES.test(entry.name)) files.push(p);
  }
  return files;
}

const findings = [];
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const content = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file);
    if (rel.includes('secretsAudit.ts') && content.includes('eyJ[')) continue;
    for (const { name, regex } of PATTERNS) {
      if (regex.test(content)) {
        findings.push({ file: rel, pattern: name });
      }
    }
  }
}

console.log('\n=== Secrets Scan ===\n');
if (findings.length === 0) {
  console.log('✓ No hardcoded secrets detected in src/ and supabase/functions/\n');
} else {
  for (const f of findings) console.log(`✗ ${f.pattern} in ${f.file}`);
  console.log(`\n${findings.length} finding(s)\n`);
}

const report = {
  generatedAt: new Date().toISOString(),
  scanned: SCAN_DIRS,
  findings,
  passed: findings.length === 0,
};

mkdirSync(join(ROOT, 'supabase/benchmarks'), { recursive: true });
writeFileSync(join(ROOT, 'supabase/benchmarks/secrets-scan.json'), JSON.stringify(report, null, 2));

process.exit(findings.length === 0 ? 0 : 1);
