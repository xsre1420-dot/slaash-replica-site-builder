-- v61: Allow platform_benchmark_hot_queries from postgres role (CLI / SQL editor)

CREATE OR REPLACE FUNCTION public.platform_benchmark_hot_queries(
  p_slug text DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_warm_cache boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_owner uuid;
  v_results jsonb := '[]'::jsonb;
  v_plan jsonb;
  v_exec_ms numeric;
  v_plan_ms numeric;
  rec record;
  v_allowed boolean;
BEGIN
  v_allowed :=
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin', 'authenticator');

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  SELECT ss.store_slug, ss.owner_id
  INTO v_slug, v_owner
  FROM public.store_settings ss
  WHERE ss.store_slug IS NOT NULL
  ORDER BY ss.updated_at DESC NULLS LAST
  LIMIT 1;

  v_slug := COALESCE(NULLIF(trim(p_slug), ''), v_slug);
  v_owner := COALESCE(p_owner_id, v_owner);

  IF p_warm_cache THEN
    BEGIN
      PERFORM pg_prewarm('products');
      PERFORM pg_prewarm('orders');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF v_owner IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('storefront_meta', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_store_meta(%L::text)',
        v_slug
      )),
      ('storefront_products_page', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_store_products_page(%L, 24, NULL, NULL, NULL)',
        v_slug
      )),
      ('owner_products_page', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_owner_products_page(%L::uuid, 50, 0, NULL, NULL, ''grid'', NULL)',
        v_owner
      )),
      ('owner_products_keyset', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_owner_products_page(%L::uuid, 50, 0, NULL, NULL, ''grid'', ''2020-01-01T00:00:00+00|00000000-0000-0000-0000-000000000001'')',
        v_owner
      )),
      ('orders_list', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.list_merchant_orders(%L::uuid, 0, 50, NULL, ''all'', ''all'', ''all'', ''all'', NULL, NULL, NULL, NULL, NULL)',
        v_owner
      )),
      ('workflow_counts', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.count_merchant_orders_by_workflow(%L::uuid, NULL, ''all'', ''all'', ''all'', NULL, NULL, NULL, NULL)',
        v_owner
      )),
      ('dashboard_batch', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_dashboard_statistics_batch(%L::uuid)',
        v_owner
      )),
      ('products_owner_index', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT COUNT(*) FROM public.products WHERE owner_id = %L::uuid AND archived_at IS NULL',
        v_owner
      )),
      ('orders_owner_index', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT COUNT(*) FROM public.orders WHERE owner_id = %L::uuid',
        v_owner
      ))
    ) AS t(name, sql_text)
  LOOP
    BEGIN
      EXECUTE rec.sql_text INTO v_plan;
      v_exec_ms := (v_plan->0->>'Execution Time')::numeric;
      v_plan_ms := (v_plan->0->>'Planning Time')::numeric;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'name', rec.name,
        'plan', v_plan,
        'execution_ms', v_exec_ms,
        'planning_ms', v_plan_ms
      ));
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'name', rec.name,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'benchmark_at', now(),
    'slug', v_slug,
    'owner_id', v_owner,
    'queries', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_benchmark_hot_queries(text, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_benchmark_hot_queries(text, uuid, boolean) TO service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (61, 'benchmark RPC: allow postgres CLI + keyset path probe')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
