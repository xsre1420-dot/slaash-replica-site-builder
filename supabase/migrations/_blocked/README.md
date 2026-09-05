# Blocked migrations

Migrations in this directory are **intentionally excluded** from the active
`supabase/migrations/` set. They must **never** be moved back without an
explicit Phase 2A/2B approval and security review.

## `20260731000002_analytics_visit_count_fix.sql.blocked` (v100)

| Item | Detail |
|------|--------|
| **Production status** | **Never deployed** — not present in linked remote migration history |
| **Status** | **BLOCKED** — do not restore to active migrations |
| **Reason** | Introduces synchronous hot-path analytics processing on storefront visit and product-view RPCs: `PERFORM public.process_analytics_event_buffer(50);` This increases database pressure and connection contention under concurrent storefront load. |
| **Replacement — visit tracking** | `20260829000001_store_visit_async_analytics_only.sql` (v103) — outbox insert only, no sync flush |
| **Replacement — product view / analytics isolation** | `20260902160000` analytics isolation phase 5 — async outbox only |
| **Replacement — analytics processor / merchant flush** | `20260902000009_tenant_isolation_security_phase_7.sql` (Phase 7) — tenant-scoped `process_analytics_event_buffer` and `flush_merchant_analytics_buffer` |

There is **no** skip stub and **no** fake `supabase_migrations.schema_migrations`
entry for v100. The version is omitted from the active migration directory so
`supabase db push` will never apply it.
