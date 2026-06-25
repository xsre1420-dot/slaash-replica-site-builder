-- STAGING ONLY — production-scale benchmark seed (run manually on isolated project)
-- Targets: multi-tenant shape for EXPLAIN at scale. Adjust v_owners / batch sizes for your hardware.
--
-- Usage (staging):
--   supabase db query --linked -f scripts/seed-production-scale-benchmark.sql
--
-- WARNING: Do NOT run on production. Generates synthetic rows.

DO $$
DECLARE
  v_owners int := 100;          -- increase toward 100000 on dedicated benchmark cluster
  v_products_per_owner int := 100; -- × owners → 10M at 100k owners × 100 products
  v_orders_per_owner int := 50;
  v_items_per_order int := 3;
  v_owner uuid;
  v_store uuid;
  v_product uuid;
  v_order uuid;
  i int;
  j int;
  k int;
BEGIN
  RAISE NOTICE 'Scale seed: % owners × % products (staging benchmark only)', v_owners, v_products_per_owner;

  FOR i IN 1..v_owners LOOP
    v_owner := gen_random_uuid();

    INSERT INTO public.store_settings (owner_id, store_name, store_slug)
    VALUES (v_owner, 'Bench Store ' || i, 'bench-' || i || '-' || substr(md5(v_owner::text), 1, 8))
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_store FROM public.stores WHERE user_id = v_owner LIMIT 1;

    FOR j IN 1..v_products_per_owner LOOP
      INSERT INTO public.products (
        owner_id, store_id, name, category, price, image_url, stock_quantity, is_active
      ) VALUES (
        v_owner, v_store, 'Product ' || j, 'cat', (random() * 100)::numeric(10,2),
        'https://example.com/p.jpg', (random() * 50)::int, true
      );
    END LOOP;

    FOR j IN 1..v_orders_per_owner LOOP
      v_order := gen_random_uuid();
      INSERT INTO public.orders (
        id, owner_id, customer_name, customer_phone, customer_address,
        total_amount, status, payment_status, created_at
      ) VALUES (
        v_order, v_owner, 'Customer', '0790000000', 'Addr',
        (random() * 200)::numeric(10,2),
        CASE WHEN random() < 0.7 THEN 'completed' WHEN random() < 0.9 THEN 'pending' ELSE 'cancelled' END,
        'pending_collection',
        NOW() - (random() * 365 || ' days')::interval
      );

      FOR k IN 1..v_items_per_order LOOP
        SELECT id INTO v_product
        FROM public.products
        WHERE owner_id = v_owner
        ORDER BY random()
        LIMIT 1;

        IF v_product IS NOT NULL THEN
          INSERT INTO public.order_items (
            order_id, owner_id, product_id, product_name, product_price, quantity, subtotal
          ) VALUES (
            v_order, v_owner, v_product, 'Item', 10, 1, 10
          );
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  ANALYZE public.products;
  ANALYZE public.orders;
  ANALYZE public.order_items;
  RAISE NOTICE 'Scale seed complete';
END $$;
