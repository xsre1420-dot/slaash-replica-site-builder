
-- ============================================
-- PHASE 4: Database Optimization - Indexes
-- ============================================

-- Products: owner_id is queried on every page load
CREATE INDEX IF NOT EXISTS idx_products_owner_id ON public.products (owner_id);

-- Products: category filtering
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category);

-- Products: active products listing (store front)
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products (is_active) WHERE is_active = true;

-- Products: composite index for owner + active + created_at (dashboard listing)
CREATE INDEX IF NOT EXISTS idx_products_owner_active_created ON public.products (owner_id, is_active, created_at DESC);

-- Orders: owner_id is queried on every orders page
CREATE INDEX IF NOT EXISTS idx_orders_owner_id ON public.orders (owner_id);

-- Orders: status filtering
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);

-- Orders: date range queries for statistics
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);

-- Orders: composite for owner + date (statistics page)
CREATE INDEX IF NOT EXISTS idx_orders_owner_created ON public.orders (owner_id, created_at DESC);

-- Categories: owner_id + display_order (always queried together)
CREATE INDEX IF NOT EXISTS idx_categories_owner_order ON public.categories (owner_id, display_order ASC);

-- Store settings: owner_id lookup
CREATE INDEX IF NOT EXISTS idx_store_settings_owner ON public.store_settings (owner_id);

-- Profiles: user_id lookup (used on every auth check)
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);

-- Product reviews: product_id for product detail page
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.product_reviews (product_id);

-- Suggested products: product_id for product detail page
CREATE INDEX IF NOT EXISTS idx_suggested_product ON public.suggested_products (product_id);

-- Marketing settings: owner_id
CREATE INDEX IF NOT EXISTS idx_marketing_owner ON public.marketing_settings (owner_id);
