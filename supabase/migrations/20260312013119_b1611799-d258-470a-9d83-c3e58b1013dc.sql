
-- ============================================
-- PHASE 7: Multi-Tenant SaaS Architecture
-- ============================================

-- 1. Add store_slug to store_settings for public URL routing
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS store_slug TEXT;

-- 2. Create unique index on store_slug (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_settings_slug 
ON public.store_settings (LOWER(store_slug)) WHERE store_slug IS NOT NULL;

-- 3. Create a secure function to look up owner_id by slug (no RLS bypass needed for public)
CREATE OR REPLACE FUNCTION public.get_store_by_slug(p_slug TEXT)
RETURNS TABLE (
  owner_id UUID,
  store_name TEXT,
  store_logo TEXT,
  store_slug TEXT,
  menu_background_color TEXT,
  menu_text_color TEXT,
  menu_accent_color TEXT,
  banner_images TEXT[],
  primary_banner_index INTEGER,
  delivery_prices JSONB,
  whatsapp_number TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  return_policy TEXT,
  privacy_policy TEXT,
  payment_methods JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.owner_id, s.store_name, s.store_logo, s.store_slug,
    s.menu_background_color, s.menu_text_color, s.menu_accent_color,
    s.banner_images, s.primary_banner_index, s.delivery_prices,
    s.whatsapp_number, s.facebook_url, s.instagram_url,
    s.return_policy, s.privacy_policy, s.payment_methods
  FROM public.store_settings s
  WHERE LOWER(s.store_slug) = LOWER(p_slug)
  LIMIT 1;
$$;

-- 4. Create a function to get public products for a store owner
CREATE OR REPLACE FUNCTION public.get_store_products(p_owner_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  price NUMERIC,
  image_url TEXT,
  additional_images TEXT[],
  colors JSONB,
  sizes TEXT[],
  variants JSONB,
  discount_type TEXT,
  discount_value NUMERIC,
  original_price NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id, p.name, p.description, p.category, p.price,
    p.image_url, p.additional_images, p.colors, p.sizes, p.variants,
    NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC
  FROM public.products p
  WHERE p.owner_id = p_owner_id AND p.is_active = true
  ORDER BY p.created_at DESC;
$$;

-- 5. Create a function to get categories for a store owner
CREATE OR REPLACE FUNCTION public.get_store_categories(p_owner_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  display_order INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.display_order
  FROM public.categories c
  WHERE c.owner_id = p_owner_id
  ORDER BY c.display_order ASC;
$$;

-- 6. Function to validate slug uniqueness and format
CREATE OR REPLACE FUNCTION public.validate_store_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Validate slug format (lowercase, alphanumeric + hyphens, 3-30 chars)
  IF NEW.store_slug IS NOT NULL AND NEW.store_slug !~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' THEN
    RAISE EXCEPTION 'Invalid slug format. Use 3-30 lowercase letters, numbers, and hyphens.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_slug_before_upsert
BEFORE INSERT OR UPDATE ON public.store_settings
FOR EACH ROW
WHEN (NEW.store_slug IS NOT NULL)
EXECUTE FUNCTION public.validate_store_slug();

-- 7. Auto-generate slug from username on profile creation
CREATE OR REPLACE FUNCTION public.auto_generate_store_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Generate base slug from username
  base_slug := LOWER(REGEXP_REPLACE(COALESCE(NEW.username, 'store'), '[^a-z0-9]', '-', 'g'));
  base_slug := TRIM(BOTH '-' FROM base_slug);
  
  -- Ensure minimum length
  IF LENGTH(base_slug) < 3 THEN
    base_slug := base_slug || '-store';
  END IF;
  
  final_slug := base_slug;
  
  -- Check uniqueness and append number if needed
  WHILE EXISTS (SELECT 1 FROM public.store_settings WHERE LOWER(store_slug) = final_slug AND owner_id != NEW.user_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  -- Update store_settings with the generated slug
  UPDATE public.store_settings 
  SET store_slug = final_slug 
  WHERE owner_id = NEW.user_id AND store_slug IS NULL;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_slug_on_profile
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_store_slug();
