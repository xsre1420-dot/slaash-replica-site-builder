-- Variant color matching (case-insensitive) + enable realtime for merchant order notifications

CREATE OR REPLACE FUNCTION public.adjust_product_variants(
  p_variants JSONB,
  p_size TEXT,
  p_color TEXT,
  p_qty_delta INT
) RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN (p_size IS NULL OR elem->>'size' = p_size)
         AND (
           p_color IS NULL
           OR lower(COALESCE(elem->>'color', '')) = lower(COALESCE(p_color, ''))
         )
        THEN jsonb_set(
          elem,
          '{quantity}',
          to_jsonb(GREATEST(0, COALESCE((elem->>'quantity')::INT, 0) + p_qty_delta))
        )
        ELSE elem
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(COALESCE(p_variants, '[]'::jsonb)) AS t(elem);
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
  WHEN duplicate_object THEN
    NULL;
END;
$$;
