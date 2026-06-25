#!/usr/bin/env node
/**
 * Phase 2 — Detect potential N+1 patterns in src/ and edge functions.
 * Usage: node scripts/n-plus-one-inventory.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { globSync } from 'glob';

const PATTERNS = [
  {
    id: 'map_async_rpc',
    re: /\.map\s*\(\s*async[\s\S]{0,400}?\.(rpc|from)\(/g,
    severity: 'high',
    label: 'async map with DB call',
  },
  {
    id: 'for_await_db',
    re: /for\s*\([^)]+\)\s*\{[\s\S]{0,300}?await[\s\S]{0,120}?\.(rpc|from)\(/g,
    severity: 'high',
    label: 'for-loop await DB',
  },
  {
    id: 'forEach_async',
    re: /\.forEach\s*\(\s*async/g,
    severity: 'medium',
    label: 'forEach(async) — unawaited parallel',
  },
];

const BATCH_GOOD = [
  'enrichOrdersWithProductImages',
  'fetchProductCards',
  'fetchCheckoutProductsByIds',
  'queryProductsByIdsForOwner',
  'Promise.all',
];

const scan = () => {
  const files = globSync('{src,supabase/functions}/**/*.{ts,tsx}', {
    ignore: ['**/*.test.*', '**/types.generated.ts', '**/node_modules/**'],
  });

  const findings = [];
  const mitigated = [];

  for (const file of files) {
    const content = readFileSync(join(process.cwd(), file), 'utf8');
    const rel = file.replace(/\\/g, '/');

    for (const pat of PATTERNS) {
      pat.re.lastIndex = 0;
      let m;
      while ((m = pat.re.exec(content)) !== null) {
        const line = content.slice(0, m.index).split('\n').length;
        const snippet = m[0].replace(/\s+/g, ' ').slice(0, 120);
        const hasBatchMitigation = BATCH_GOOD.some((g) => content.includes(g));
        const entry = {
          file: rel,
          line,
          pattern: pat.id,
          severity: pat.severity,
          label: pat.label,
          snippet,
        };
        if (hasBatchMitigation && pat.id !== 'for_await_db') {
          mitigated.push(entry);
        } else {
          findings.push(entry);
        }
      }
    }
  }

  return { findings, mitigated, scannedFiles: files.length };
};

const { findings, mitigated, scannedFiles } = scan();

const summary = {
  generatedAt: new Date().toISOString(),
  scannedFiles,
  openFindings: findings.length,
  mitigatedPatterns: mitigated.length,
};

const outJson = join(process.cwd(), 'supabase/N_PLUS_ONE_INVENTORY.json');
const outMd = join(process.cwd(), 'supabase/N_PLUS_ONE_INVENTORY.md');

writeFileSync(outJson, JSON.stringify({ summary, findings, mitigated }, null, 2));

writeFileSync(
  outMd,
  [
    '# N+1 Pattern Inventory — Phase 2',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Files scanned | ${scannedFiles} |`,
    `| Open findings | ${findings.length} |`,
    `| Mitigated | ${mitigated.length} |`,
    '',
    findings.length
      ? findings.map((f) => `- **${f.severity}** \`${f.file}:${f.line}\` — ${f.label}`).join('\n')
      : '_No open N+1 patterns detected._',
    '',
  ].join('\n')
);

console.log(`✓ N+1 inventory: ${findings.length} open, ${mitigated.length} mitigated`);
console.log(`  → ${outJson}`);
