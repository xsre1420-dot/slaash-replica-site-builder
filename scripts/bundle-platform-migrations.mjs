#!/usr/bin/env node
/**
 * Bundle June 2026 platform migrations into one SQL file for manual Supabase deploy.
 * Usage: node scripts/bundle-platform-migrations.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
const outPath = join(process.cwd(), 'supabase', 'apply-platform-sync-bundle.sql');

const files = readdirSync(migrationsDir)
  .filter((f) => f.startsWith('20260616') && f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error('No 20260616*.sql migrations found.');
  process.exit(1);
}

const parts = [
  '-- Slaash Platform Sync Bundle',
  `-- Generated: ${new Date().toISOString()}`,
  `-- Files: ${files.length}`,
  '-- Run in Supabase SQL Editor (idempotent where noted)',
  '',
];

for (const file of files) {
  parts.push(`-- ── ${file} ──`);
  parts.push(readFileSync(join(migrationsDir, file), 'utf8'));
  parts.push('');
}

writeFileSync(outPath, parts.join('\n'), 'utf8');
console.log(`✓ Wrote ${outPath} (${files.length} migrations)`);
files.forEach((f) => console.log(`  - ${f}`));
