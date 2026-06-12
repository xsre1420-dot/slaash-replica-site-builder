#!/usr/bin/env sh
# Restore database from SQL dump
# Usage: ./scripts/restore-database.sh path/to/backup.sql
# WARNING: destructive — restores into linked Supabase project

set -eu

DUMP_FILE="${1:-}"

if [ -z "$DUMP_FILE" ] || [ ! -f "$DUMP_FILE" ]; then
  echo "[restore] ERROR: provide path to .sql dump file"
  echo "Usage: ./scripts/restore-database.sh backups/db-backup-YYYYMMDD.sql"
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "[restore] ERROR: supabase CLI not installed"
  exit 1
fi

echo "[restore] WARNING: this will apply ${DUMP_FILE} to the linked project"
echo "[restore] Press Ctrl+C within 10s to abort..."
sleep 10

psql "$(supabase db url)" -f "$DUMP_FILE"

echo "[restore] Done. Run: npm run recovery:check"
