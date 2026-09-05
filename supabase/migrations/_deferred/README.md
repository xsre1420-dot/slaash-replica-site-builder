# Deferred migrations

Migrations in this directory are **intentionally excluded** from the active
`supabase/migrations/` set. Supabase CLI ignores subdirectories, so these files
are never picked up by a blind `supabase db push`.

## Why

Production uses **selective/wave deployments**. Several migrations were skipped
while later migrations were applied out of order. Applying all pending migrations
at once would be unsafe.

## Deploy a wave

```bash
# Audit current drift
npm run db:migration:audit

# Preview a wave (e.g. dashboard phase 3.4)
npm run db:migration:wave -- --wave=phase-3.4-dashboard --dry-run

# Apply after review
npm run db:migration:wave -- --wave=phase-3.4-dashboard --apply
```

Checkout phase 3.6 requires explicit approval:

```bash
npm run db:migration:wave -- --wave=phase-3.6-checkout --apply --i-approve
```

## Canonical registry

See `supabase/migration-manifest.json` for version status, waves, dependencies,
and schema probes.

## Never

- Do **not** move files back to `supabase/migrations/` manually for bulk deploy.
- Do **not** run `supabase db push --include-all` (blocked by `npm run db:push`).
- Do **not** apply `20260731000002` (permanently blocked — see `_blocked/`).
