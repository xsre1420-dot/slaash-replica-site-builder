
-- Performance indexes for frequently queried columns

-- Products: owner_id is used in every query with RLS
CREATE INDEX IF NOT EXISTS idx_products_owner_id ON public.products(owner_id);
-- Products: category filter
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
-- Products: active status filter
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
-- Products: created_at for sorting
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);
-- Products: composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_products_owner_active ON public.products(owner_id, is_active);

-- Orders: owner_id for RLS
CREATE INDEX IF NOT EXISTS idx_orders_owner_id ON public.orders(owner_id);
-- Orders: status filter
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
-- Orders: created_at for sorting
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
-- Orders: composite for common pattern
CREATE INDEX IF NOT EXISTS idx_orders_owner_status ON public.orders(owner_id, status);

-- Categories: owner_id + display_order for sorted listing
CREATE INDEX IF NOT EXISTS idx_categories_owner_order ON public.categories(owner_id, display_order);

-- Store Settings: owner_id for RLS
CREATE INDEX IF NOT EXISTS idx_store_settings_owner_id ON public.store_settings(owner_id);

-- Profiles: user_id for lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
-- Profiles: username for store URL lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Product Reviews: product_id for product detail page
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.product_reviews(product_id);
-- Product Reviews: owner_id for RLS
CREATE INDEX IF NOT EXISTS idx_reviews_owner_id ON public.product_reviews(owner_id);

-- Suggested Products: product_id for lookups
CREATE INDEX IF NOT EXISTS idx_suggested_product_id ON public.suggested_products(product_id);
-- Suggested Products: owner_id for RLS
CREATE INDEX IF NOT EXISTS idx_suggested_owner_id ON public.suggested_products(owner_id);
