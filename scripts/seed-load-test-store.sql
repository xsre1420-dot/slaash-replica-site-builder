-- One-time seed for load/capacity testing (idempotent).
-- Slug: bidaya-demo — uses store_settings + products (no stores FK).

DO $$
DECLARE
  v_owner UUID := '4f273c88-0b36-4ed8-8c98-bf49a1f4ce6d';
  v_slug TEXT := 'bidaya-demo';
  v_name TEXT := 'متجر بداية — اختبار الحمل';
  i INT;
BEGIN
  INSERT INTO public.store_settings (owner_id, store_name, store_slug)
  VALUES (v_owner, v_name, v_slug)
  ON CONFLICT (owner_id) DO UPDATE SET
    store_name = EXCLUDED.store_name,
    store_slug = EXCLUDED.store_slug,
    updated_at = now();

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE owner_id = v_owner LIMIT 1) THEN
    FOR i IN 1..24 LOOP
      INSERT INTO public.products (
        owner_id,
        name,
        description,
        category,
        price,
        stock_quantity,
        is_active
      )
      VALUES (
        v_owner,
        'منتج تجريبي ' || i,
        'لاختبار تحمل المنصة',
        'عام',
        (10000 + i * 1000)::numeric,
        100,
        true
      );
    END LOOP;
  END IF;
END $$;
