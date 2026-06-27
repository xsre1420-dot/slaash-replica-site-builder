-- v63: Phase 3 index optimization — merge covering indexes, drop redundant/unsafe indexes, ANALYZE

-- ---------------------------------------------------------------------------
-- 1) Drop redundant / tenant-unsafe indexes
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_order_items_order_id;
-- Superseded by idx_order_items_order_id_id (v60)

DROP INDEX IF EXISTS public.idx_orders_created_at;
-- Global created_at without owner_id — poor multi-tenant selectivity, unused on hot paths

DROP INDEX IF EXISTS public.idx_customers_phone;
-- Phone without owner_id — tenant isolation risk; superseded by idx_customers_owner_phone

DROP INDEX IF EXISTS public.idx_products_owner_name;
-- Superseded by idx_products_owner_search_name (text_pattern_ops) + idx_products_name_trgm (GIN)

-- ---------------------------------------------------------------------------
-- 2) Unified orders list + dashboard covering index (replaces two overlapping btree)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_orders_owner_created_id;
DROP INDEX IF EXISTS public.idx_orders_owner_created_status;

CREATE INDEX IF NOT EXISTS idx_orders_owner_created_id_covering
  ON public.orders (owner_id, created_at DESC, id DESC)
  INCLUDE (status, total_amount, payment_status, delivery_status, customer_name, customer_phone);

COMMENT ON INDEX public.idx_orders_owner_created_id_covering IS
  'Keyset list_merchant_orders + dashboard FILTER aggregates — single covering index';

-- ---------------------------------------------------------------------------
-- 3) Product lookup covering index — order line-item join + checkout batch by ids
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_owner_id_include
  ON public.products (owner_id, id)
  INCLUDE (image_url, name, price, stock_quantity, is_active, archived_at);

COMMENT ON INDEX public.idx_products_owner_id_include IS
  'list_merchant_orders product join + get_checkout_products_by_ids — index-only friendly';

-- ---------------------------------------------------------------------------
-- 4) Order items — tenant + product analytics path
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_order_items_owner_product_created
  ON public.order_items (owner_id, product_id, created_at DESC);

COMMENT ON INDEX public.idx_order_items_owner_product_created IS
  'Top-selling products / statistics order_items fallback — tenant-scoped';

-- ---------------------------------------------------------------------------
-- 5) Suggested products — carousel lookup by source product
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_suggested_products_owner_product
  ON public.suggested_products (owner_id, product_id, display_order);

COMMENT ON INDEX public.idx_suggested_products_owner_product IS
  'fetchSuggestedProductsForOwner — links by product_id per tenant';

-- ---------------------------------------------------------------------------
-- 6) Refresh planner statistics
-- ---------------------------------------------------------------------------
ANALYZE public.products;
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.store_visits;
ANALYZE public.store_settings;
ANALYZE public.customers;
ANALYZE public.store_daily_stats;
ANALYZE public.suggested_products;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (63, 'phase3_index_optimization: covering indexes, drop redundant/unsafe indexes')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
