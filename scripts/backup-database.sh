#!/usr/bin/env sh
# Database backup via Supabase CLI
# Prerequisites: supabase CLI, SUPABASE_ACCESS_TOKEN, linked project
# Usage: ./scripts/backup-database.sh [output-dir]

set -eu

OUT_DIR="${1:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${OUT_DIR}/db-backup-${STAMP}.sql"

mkdir -p "$OUT_DIR"

echo "[backup] Starting database dump -> ${OUT_FILE}"

if ! command -v supabase >/dev/null 2>&1; then
  echo "[backup] ERROR: supabase CLI not installed"
  exit 1
fi

supabase db dump -f "$OUT_FILE"

echo "[backup] OK: ${OUT_FILE}"
echo "[backup] Tip: enable Supabase Point-in-Time Recovery (PITR) for RPO < 1 minute"
