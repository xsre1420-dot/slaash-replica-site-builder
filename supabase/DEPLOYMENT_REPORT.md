# Migration Deployment Report — v17 through v57

**Generated:** 2026-06-25  
**Project:** https://mpifosptgoxvroblrrte.supabase.co  
**Scope:** `20260625000017` → `20260625000057` (31 migration files)

---

## 1. Pre-Deploy Verification

### Migration inventory

| Check | Result |
|-------|--------|
| Pending files on disk | **31** (v17–v30, v41–v57) |
| Chronological order | **PASS** — timestamps strictly ascending |
| Gap v31–v40 | **Expected** — no files on disk |
| Non-IF-NOT-EXISTS `CREATE TABLE` conflicts | **0** |
| Function redefinitions in pending set | **20** (intentional `CREATE OR REPLACE` chains) |

### Conflict fixes applied before deploy

| Migration | Issue | Fix |
|-----------|-------|-----|
| `20260625000024_product_lifecycle_sync.sql` | `get_store_products_by_slug` return type change (16 → 14 columns vs v07) | Added `DROP FUNCTION IF EXISTS` before recreate |
| `20260625000044_payload_optimization.sql` | `get_owner_products_page` new `p_profile` arg | Added `DROP FUNCTION IF EXISTS (UUID, INT, INT, TEXT, TEXT)` |
| `20260625000049_index_query_optimization.sql` | `get_owner_products_page` new `p_cursor` arg | Added `DROP FUNCTION IF EXISTS (UUID, INT, INT, TEXT, TEXT, TEXT)` |
| `20260625000043_write_amplification_reduction.sql` | `increment_product_stock` new `p_min_stock_level` arg | Added `DROP FUNCTION IF EXISTS (UUID, UUID, INT, TEXT)` |

### First deploy attempt

- **Applied:** v17–v23 (7 migrations)
- **Failed at:** v24 — `cannot change return type of existing function get_store_products_by_slug`
- **Resolution:** DROP + recreate fix in v24; redeploy succeeded

---

## 2. Deployment Plan (executed)

1. Capture pre-deploy schema snapshot (`scripts/schema-snapshot.mjs`)
2. `npm run db:deploy` → `supabase db push --yes` (31 pending migrations)
3. Auto-regenerate types via `db-push.ps1`
4. Post-deploy: `npm run db:audit`, `npm run db:verify`, schema drift snapshot

### Migrations deployed (31)

```
20260625000017_tenant_isolation_security.sql
20260625000018_order_creation_reliability.sql
20260625000019_postgresql_performance_audit.sql
20260625000020_analytics_accuracy.sql
20260625000021_security_hardening.sql
20260625000022_scale_500_to_1000.sql
20260625000023_schema_code_sync.sql
20260625000024_product_lifecycle_sync.sql
20260625000025_order_reliability.sql
20260625000026_saas_scale_performance.sql
20260625000027_tenant_isolation_reapply.sql
20260625000028_analytics_optimization.sql
20260625000029_security_audit_fixes.sql
20260625000030_scale_performance_v40.sql
20260625000041_storefront_load_bottlenecks.sql
20260625000042_hot_table_optimizations.sql
20260625000043_write_amplification_reduction.sql
20260625000044_payload_optimization.sql
20260625000045_transaction_integrity.sql
20260625000046_transaction_integrity_v2.sql
20260625000047_checkout_variant_consolidation.sql
20260625000048_over_fetching_reduction.sql
20260625000049_index_query_optimization.sql
20260625000050_merchant_product_by_id.sql
20260625000051_analytics_event_buffer.sql
20260625000052_analytics_outbox_tenant_lock.sql
20260625000053_inventory_architecture_audit.sql
20260625000054_analytics_hot_path_hardening.sql
20260625000055_background_processing.sql
20260625000056_edge_cache_versioning.sql
20260625000057_storefront_payload_optimization.sql
```

**Remote now at:** `20260625000057` (145/145 local migrations applied)

---

## 3. Before / After Comparison

### RPC counts (PostgREST-exposed, from `types.generated.ts`)

| Metric | Before | After | Goal |
|--------|-------:|------:|------|
| RPCs in live types | **95** | **118** | — |
| Frontend RPCs missing from types | **10** | **0** | **0** ✅ |
| All frontend RPCs in types (`db:audit`) | ❌ | ✅ | ✅ |

**10 frontend RPCs resolved by deployment:**

- `audit_merchant_analytics_health`
- `audit_merchant_inventory_integrity`
- `bump_storefront_cache_version`
- `get_background_jobs_status`
- `get_merchant_product_by_id`
- `get_statistics_page_bundle`
- `get_store_policies`
- `record_initial_stock_movements`
- `record_product_initial_stock`
- `retry_order_webhook_events`

**23 new RPCs now in types** (examples): `_dashboard_period_json`, `_resolve_store_owner_by_slug`, `claim_order_webhook_outbox_batch`, `get_analytics_pipeline_status`, `get_storefront_cache_version`, `process_analytics_event_buffer`, `storefront_product_grid_json`, etc.

### Tables

| Metric | Before | After | Goal |
|--------|-------:|------:|------|
| Tables in live types | **37** | **38** | — |
| Tables missing vs local migrations | **1** | **0** | **0** ✅ |

| Missing table | Before | After |
|---------------|--------|-------|
| `analytics_event_outbox` | ❌ missing | ✅ present |

### Columns

| Metric | Before | After | Goal |
|--------|-------:|------:|------|
| Columns missing vs local migrations | **3** | **0** | **0** ✅ |

| Column | Before | After |
|--------|--------|-------|
| `store_settings.order_webhook_url` | ❌ | ✅ |
| `order_webhook_outbox.next_attempt_at` | ❌ | ✅ |
| `store_settings.storefront_cache_version` | ❌ | ✅ |

---

## 4. Post-Deploy Verification

| Check | Result |
|-------|--------|
| `npm run db:types` | ✅ (via `db:deploy` / `db-push.ps1`) |
| `npm run db:audit` | ✅ All frontend RPCs exist; all table queries exist; no column drift |
| `npm run db:verify` | ⚠️ **BLOCKED** — `SUPABASE_SERVICE_ROLE_KEY` not in `.env`; anon key denied for `platform_health_check` |
| Schema drift snapshot | ✅ 0 missing tables, 0 missing columns, 0 frontend RPC gaps |

### Remaining internal functions not in PostgREST types (41)

These are **trigger handlers and internal utilities** (e.g. `handle_new_user`, `trg_orders_daily_stats`, `update_updated_at_column`). They exist in the database but are intentionally not exposed via the PostgREST API surface. **Not counted as app-facing drift.**

---

## 5. Goal Scorecard

| Goal | Status |
|------|--------|
| 0 missing frontend RPCs | ✅ **ACHIEVED** |
| 0 missing tables (local vs live) | ✅ **ACHIEVED** |
| 0 missing columns (local vs live) | ✅ **ACHIEVED** |
| 0 schema drift (app-facing) | ✅ **ACHIEVED** (`db:audit` clean) |
| `db:verify` pass | ⚠️ **Pending** — add `SUPABASE_SERVICE_ROLE_KEY` to `.env` and re-run |

---

## 6. Next Step

Add to `.env`:

```
SUPABASE_SERVICE_ROLE_KEY=<from Supabase Dashboard → Settings → API>
```

Then run:

```bash
npm run db:verify
```

---

**Artifacts:** `supabase/.schema-snapshot-before.json`, `supabase/.schema-snapshot-after.json`, `supabase/SCHEMA_SYNC_REPORT.md`
