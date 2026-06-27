# PostgreSQL Performance Audit

**Date:** 2026-06-19  
**Migration:** `20260625000019_postgresql_performance_audit.sql` (schema **v29**)

## Scope

| Domain | Hot paths audited |
|--------|-------------------|
| **Products** | `get_store_products_page`, `get_owner_products_page`, merchant list, checkout `FOR UPDATE` |
| **Orders** | `list_merchant_orders`, `create_order_with_stock_deduction`, statistics fallbacks |
| **Inventory** | `inventory_movements` history, checkout stock deduction |
| **Customers** | Checkout UPSERT `(owner_id, phone)`, analytics `first_order_date` / `last_order_date` |
| **Analytics** | `get_store_statistics`, `get_dashboard_statistics_batch`, `get_order_items_for_statistics` |
| **Stores** | Slug lookup `idx_store_settings_slug`, `idx_stores_slug_lower`, bootstrap RPCs |

---

## Pre-audit state (strengths)

- **Order list:** trigram GIN on customer name/phone + filter indexes on payment/delivery status (v19–v20)
- **Storefront:** partial `idx_products_owner_active_created` for keyset pagination
- **Visits:** dedupe indexes `(owner_id, visitor_ip, page_path, created_at)` (v21)
- **Checkout:** unique `(owner_id, idempotency_key)` + advisory lock (v28)
- **Inventory:** `(product_id, owner_id, created_at DESC)` for movement history
- **v24 cleanup:** dropped duplicate `idx_orders_owner_id`, `idx_orders_owner_created_at`, `idx_products_owner_id`

---

## Issues found

| Issue | Impact | Fix (v29) |
|-------|--------|-----------|
| `idx_products_owner_category_created` stale (v7 `IF NOT EXISTS` blocked v23) | Category storefront pages miss `id DESC` keyset column | DROP + CREATE with correct partial predicate |
| No `order_items (owner_id, created_at)` | Statistics client fallback seq scan | `idx_order_items_owner_created` |
| Completed-order analytics join starts from `order_items` | Suboptimal plan vs orders partial index | `idx_orders_owner_completed_created` + RPC rewrite |
| Pending orders KPI scans full owner index | Extra filter work on `status = 'pending'` | `idx_orders_owner_pending_created` |
| Redundant single-column indexes | Write amplification, cache churn | Drop 11 superseded indexes |
| `store_settings.owner_id` no FK | Orphan rows, planner can't assume integrity | FK when no orphans |
| Stale planner stats after index churn | Bad row estimates | `ANALYZE` on 10 hot tables |

---

## Indexes added (v29)

```sql
idx_products_owner_category_created   -- (owner_id, category, created_at DESC, id DESC) partial active
idx_order_items_owner_created         -- (owner_id, created_at DESC)
idx_orders_owner_completed_created    -- (owner_id, created_at DESC) WHERE status = 'completed'
idx_orders_owner_pending_created      -- (owner_id, created_at DESC) WHERE status = 'pending'
idx_products_owner_active_catalog     -- (owner_id) partial active catalog
idx_products_owner_stock_monitor      -- (owner_id, stock_quantity) partial active + stock set
idx_products_owner_merchant_created   -- (owner_id, created_at DESC, id DESC) merchant list RPC
```

## Indexes dropped (v29)

```sql
idx_store_settings_owner              -- redundant with UNIQUE(owner_id)
idx_stores_user_id                    -- redundant with UNIQUE(user_id)
idx_store_daily_stats_owner_date      -- redundant with PK (owner_id, stat_date)
idx_store_visits_owner_id             -- superseded by owner_created composites
idx_store_visits_created_at           -- superseded
idx_categories_owner_id               -- superseded by (owner_id, display_order)
idx_products_category                 -- superseded by owner+category composite
idx_products_is_active / idx_products_active / idx_products_owner_active
```

**Kept:** `idx_products_owner_lifecycle` — merchant archived/draft/published filters.

---

## RPC optimization

**`get_order_items_for_statistics`** — join order changed to drive from `orders` (uses `idx_orders_owner_completed_created`) instead of starting at `order_items`.

---

## Foreign keys reviewed

| Table | FK | Status |
|-------|-----|--------|
| products | owner_id, store_id | OK |
| orders | owner_id, store_id | OK |
| order_items | order_id, product_id, owner_id | OK |
| inventory_movements | order_id, product_id, owner_id | OK |
| customers | owner_id, store_id; UNIQUE (owner_id, phone) | OK |
| stores | user_id | OK |
| categories | owner_id, store_id | OK |
| store_daily_stats | owner_id | OK |
| store_settings | owner_id | **FK added v29** (when no orphans) |

---

## Query plan verification (post-deploy)

Run in Supabase SQL editor after `npm run db:deploy`:

```sql
-- Storefront category page
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM products
WHERE owner_id = '<owner-uuid>'
  AND category = 'ملابس'
  AND archived_at IS NULL AND COALESCE(is_active, true)
ORDER BY created_at DESC, id DESC
LIMIT 24;

-- Order list by status
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM orders
WHERE owner_id = '<owner-uuid>' AND status = 'pending'
ORDER BY created_at DESC
LIMIT 50;

-- Statistics items
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM get_order_items_for_statistics(
  '<owner-uuid>',
  NOW() - INTERVAL '7 days',
  NOW(),
  1000
);
```

Expect: **Index Scan** or **Bitmap Index Scan** on the new partial/composite indexes — not Seq Scan on large tables.

---

## Deploy

```bash
npm run db:deploy
```

For production tables with millions of rows, prefer `CREATE INDEX CONCURRENTLY` outside a transaction (Supabase migration runner uses transactions — acceptable for current scale per load tests ~500–1000 concurrent users).

---

## Remaining recommendations (future)

1. **Dashboard batch:** replace 6× `get_store_statistics` calls with one rollup query (RPC refactor, not index-only)
2. **Materialized view** for all-time analytics if `store_daily_stats` backfill incomplete
3. **Connection pooling:** ensure Supavisor transaction mode for short RPC bursts
4. **Monitor:** `pg_stat_user_indexes` for idx_scan = 0 after 30 days → candidate drops
