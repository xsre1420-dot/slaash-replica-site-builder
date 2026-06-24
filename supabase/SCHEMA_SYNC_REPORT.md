# Supabase Schema Synchronization Report

**Generated:** 2026-06-24  
**Project:** `mpifosptgoxvroblrrte` (`https://mpifosptgoxvroblrrte.supabase.co`)  
**Schema version (live):** v26  
**Migrations on disk:** 114 (latest: `20260625000016_schema_sync_custom_domain.sql`)

---

## Executive Summary

| Area | Status |
|------|--------|
| Migrations ↔ Remote DB | ✅ In sync (v26 deployed) |
| Generated TypeScript types | ✅ Regenerated from linked project |
| Frontend RPC references | ✅ 57/57 match live schema |
| Frontend table queries | ✅ 14/14 tables exist |
| Storage buckets | ✅ `product-images` |
| Column drift (audited) | ✅ Fixed (`custom_domain`) |

---

## Live Database Inventory

### Tables (36 in `types.generated.ts`)

`categories`, `customers`, `inventory_movements`, `leads`, `marketing_coupons`, `marketing_settings`, `merchant_access_codes`, `order_audit_log`, `order_chargebacks`, `order_items`, `order_refunds`, `order_returns`, `order_webhook_outbox`, `orders`, `payment_transactions`, `payment_webhook_events`, `platform_admins`, `platform_schema_version`, `product_reviews`, `product_views`, `products`, `profiles`, `restaurant_owners`, `rpc_rate_limits`, `shipment_tracking_events`, `shipments`, `store_daily_stats`, `store_plugins`, `store_settings`, `store_subscriptions`, `store_visits`, `storefront_footer_products`, `stores`, `subscription_plans`, `subscriptions`, `suggested_products`

**Note:** Legacy docs referenced `order_payments`, `order_shipments`, `marketing_attributions` — these **do not exist**. Payments/shipments use `payment_transactions` + `shipments` tables and RPCs (`get_order_payment_summary`, `get_order_shipment`).

### Views

- `restaurant_owner_profiles` (read-only view)

### Storage Buckets

- `product-images` (merchant product uploads, RLS-protected)

### RPC Functions (90+ in schema)

All 57 RPCs called from `src/` exist in generated types, including checkout, storefront, merchant catalog, admin/leads, statistics, delivery, payments, and reviews.

**Intentionally unavailable to anon (by design):**

| RPC | Reason |
|-----|--------|
| `get_store_by_slug` | Revoked in v15 hardening (UUID leak); replaced by `get_store_meta` |
| `platform_health_check` | `authenticated` + `service_role` only |
| `get_owner_bootstrap`, `get_owner_products_page` | Merchant auth required |
| `product_checkout_available_qty`, `handle_new_user` | Internal SQL helpers, not PostgREST-exposed |

---

## Issues Detected & Fixed

### 1. Missing columns: `store_settings.custom_domain`, `domain_verified`

- **Symptom:** `CustomDomainTab.tsx` queried columns absent from live DB and generated types.
- **Fix:** Migration `20260625000016_schema_sync_custom_domain.sql` (v26) — idempotent `ALTER TABLE` + index.
- **Status:** ✅ Deployed, types regenerated.

### 2. Dead RPC reference: `get_store_by_slug`

- **Symptom:** `tenantStoreRegistry.ts` fallback called revoked RPC (404 from PostgREST).
- **Fix:** Removed fallback; storefront uses `get_storefront_page_bundle` → `get_store_meta` → `resolveStoreOwnerBySlug`.
- **Status:** ✅ Fixed in code.

### 3. `platform_health_check` response contract

- **Symptom:** RPC returned `message: 'ok'` but clients checked `ok: true` → false negatives in `db:verify`.
- **Fix:** v26 adds explicit `ok` boolean; `platformHealthService.ts` + `verify-platform-db.mjs` accept both.
- **Status:** ✅ Fixed.

### 4. Probe script false negatives

- **Symptom:** `probe-supabase-schema.mjs` used wrong table names and `select=id` on composite-PK tables.
- **Fix:** Updated table list, PK map, RPC argument payloads.
- **Status:** ✅ Fixed.

### 5. Health service fallback RPC args

- **Symptom:** `get_store_products_page` probe missing `p_cursor`/`p_category`/`p_search`.
- **Fix:** Updated `platformHealthService.ts` fallback probes.
- **Status:** ✅ Fixed.

---

## Frontend Query Audit

### Direct table access (14 tables)

All exist in schema with matching columns for audited selects:

| Table | Primary callers |
|-------|-----------------|
| `products` | CRUD, inventory, checkout validation, marketing |
| `orders` / `order_items` | Order service, statistics |
| `store_settings` / `stores` | Settings, store bootstrap, URLs |
| `categories` | Category dialog, bulk data |
| `product_reviews` | Merchant review management (authenticated INSERT) |
| `inventory_movements` | Restock audit trail |
| `marketing_*` | Coupons, pixels, analytics |
| `suggested_products` / `storefront_footer_products` | Merchandising |
| `profiles` | Auth context |
| `store_visits` | Statistics fallback |

### No removed-field references found

Product columns (`description`, `variants`, `store_id`, `archived_at`, etc.) and order columns (`payment_status`, `delivery_status`, `idempotency_key`) verified against live DB.

---

## Foreign Keys & Relationships (high level)

- `products.store_id` → `stores.id` (backfilled v24)
- `orders.store_id`, `categories.store_id`, `customers.store_id` → `stores.id`
- `order_items.order_id` → `orders.id`
- `shipments.order_id` → `orders.id`
- `store_settings.owner_id` → merchant profile (unique)
- RLS enforces `owner_id` tenant isolation on all merchant tables

---

## Verification Commands

```bash
npm run db:audit          # types vs frontend vs live probe
npm run db:verify         # requires SUPABASE_SERVICE_ROLE_KEY in .env
node scripts/probe-supabase-schema.mjs
npm run test              # 115/115 passing
```

---

## Remaining Recommendations

1. **Add `SUPABASE_SERVICE_ROLE_KEY` to `.env`** — enables automated `db:verify` and full health RPC checks in CI.
2. **Run `npm run db:audit` after each migration** — keeps report current.
3. **Deprecated RPCs** — do not re-expose `get_store_by_slug` to anon; use `get_store_meta` + edge bundle.

---

## Sync Status: ✅ ALIGNED

Codebase, generated types, and Supabase project schema are synchronized at **v26**.
