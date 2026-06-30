-- STAGING ONLY — tiered large-dataset seed for benchmark clusters.
-- Do NOT run on production.
--
-- Tiers (adjust v_owners / v_products_per_owner / v_orders_per_owner):
--   100K total rows  → v_owners=100,  products=50,  orders=10
--   500K             → v_owners=500,  products=50,  orders=20
--   1M               → v_owners=1000, products=50,  orders=20
--   5M               → v_owners=5000, products=50,  orders=20
--   10M              → v_owners=10000, products=50, orders=20
--   50M+ analytics   → use partition tables + scripts/seed-load-test-store.sql
--
-- Usage:
--   supabase db query --linked -f scripts/seed-large-dataset-tier.sql

DO $$
DECLARE
  v_tier text := '100k';  -- change: 100k | 500k | 1m | 5m | 10m
  v_owners int;
  v_products_per_owner int := 50;
  v_orders_per_owner int := 20;
  v_items_per_order int := 3;
  v_owner uuid;
  v_store uuid;
  v_product uuid;
  v_order uuid;
  i int;
  j int;
  k int;
BEGIN
  v_owners := CASE lower(v_tier)
    WHEN '100k' THEN 100
    WHEN '500k' THEN 500
    WHEN '1m' THEN 1000
    WHEN '5m' THEN 5000
    WHEN '10m' THEN 10000
    ELSE 100
  END;

  RAISE NOTICE 'Large dataset seed tier=% owners=% products/owner=% orders/owner=%',
    v_tier, v_owners, v_products_per_owner, v_orders_per_owner;

  FOR i IN 1..v_owners LOOP
    v_owner := gen_random_uuid();

    INSERT INTO public.store_settings (owner_id, store_name, store_slug)
    VALUES (
      v_owner,
      'Large Bench ' || i,
      'lbench-' || i || '-' || substr(md5(v_owner::text), 1, 6)
    )
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_store FROM public.stores WHERE user_id = v_owner LIMIT 1;

    FOR j IN 1..v_products_per_owner LOOP
      INSERT INTO public.products (
        owner_id, store_id, name, category, price, image_url, stock_quantity, is_active, created_at
      ) VALUES (
        v_owner, v_store, 'Product ' || j, 'cat-' || (j % 10), (random() * 100)::numeric(10,2),
        'https://example.com/p.jpg', (random() * 50)::int, true,
        NOW() - (random() * 730 || ' days')::interval
      );
    END LOOP;

    FOR j IN 1..v_orders_per_owner LOOP
      v_order := gen_random_uuid();
      INSERT INTO public.orders (
        id, owner_id, customer_name, customer_phone, customer_address,
        total_amount, status, payment_status, created_at
      ) VALUES (
        v_order, v_owner, 'Customer ' || j, '079' || lpad((random() * 9999999)::int::text, 7, '0'), 'Addr',
        (random() * 200)::numeric(10,2),
        CASE WHEN random() < 0.7 THEN 'completed' WHEN random() < 0.9 THEN 'pending' ELSE 'cancelled' END,
        'pending_collection',
        NOW() - (random() * 548 || ' days')::interval
      );

      FOR k IN 1..v_items_per_order LOOP
        SELECT id INTO v_product
        FROM public.products
        WHERE owner_id = v_owner
        ORDER BY id
        OFFSET (k - 1) LIMIT 1;

        IF v_product IS NOT NULL THEN
          INSERT INTO public.order_items (
            order_id, owner_id, product_id, product_name, product_price, quantity, subtotal
          ) VALUES (v_order, v_owner, v_product, 'Item', 10, 1, 10);
        END IF;
      END LOOP;
    END LOOP;

    IF i % 100 = 0 THEN
      RAISE NOTICE 'Seeded % / % owners', i, v_owners;
    END IF;
  END LOOP;

  ANALYZE public.products;
  ANALYZE public.orders;
  ANALYZE public.order_items;
  RAISE NOTICE 'Large dataset seed complete (tier=%)', v_tier;
END $$;
