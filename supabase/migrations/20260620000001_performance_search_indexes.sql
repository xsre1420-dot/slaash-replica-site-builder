-- Performance: trigram search for order list + statistics range indexes

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Date-range filters (statistics, dashboards, order lists)
CREATE INDEX IF NOT EXISTS idx_orders_owner_created_at
  ON public.orders (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_owner_order
  ON public.order_items (owner_id, order_id);

-- Trigram GIN for ILIKE search in merchant_orders_base_filter (name / phone)
CREATE INDEX IF NOT EXISTS idx_orders_customer_name_trgm
  ON public.orders USING gin (customer_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_orders_customer_phone_trgm
  ON public.orders USING gin (customer_phone gin_trgm_ops);

-- Composite filter path used by list_merchant_orders workflow tabs
CREATE INDEX IF NOT EXISTS idx_orders_owner_status_created
  ON public.orders (owner_id, status, created_at DESC);

COMMENT ON INDEX idx_orders_customer_name_trgm IS
  'Speeds ILIKE %% search on customer_name in merchant order filters';

COMMENT ON INDEX idx_orders_customer_phone_trgm IS
  'Speeds ILIKE %% search on customer_phone in merchant order filters';
