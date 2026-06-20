-- Post-audit hardening: GRANTs, checkout archived guard, generic RPC errors

GRANT EXECUTE ON FUNCTION public.get_owner_products_page(UUID, INT, INT, TEXT, TEXT) TO authenticated;

-- Align product view tracking with storefront visibility
DROP FUNCTION IF EXISTS public.track_product_view_by_slug(TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.track_product_view_by_slug(
  p_slug TEXT,
  p_product_id UUID,
  p_page_path TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' OR p_product_id IS NULL THEN
    RETURN;
  END IF;

  SELECT ss.owner_id INTO v_owner_id
  FROM store_settings ss
  WHERE LOWER(ss.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT st.user_id INTO v_owner_id
    FROM stores st
    WHERE LOWER(st.store_slug) = LOWER(trim(p_slug))
    LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = p_product_id
      AND p.owner_id = v_owner_id
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
  ) THEN
    RETURN;
  END IF;

  INSERT INTO product_views (product_id, owner_id, page_path, created_at)
  VALUES (p_product_id, v_owner_id, NULLIF(trim(p_page_path), ''), NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_product_view_by_slug(TEXT, UUID, TEXT) TO anon, authenticated;
