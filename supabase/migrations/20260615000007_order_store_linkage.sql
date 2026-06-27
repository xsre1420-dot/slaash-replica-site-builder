-- Link orders to stores for multi-tenant consistency

-- Backfill store_id for existing orders
UPDATE public.orders o
SET store_id = s.id
FROM public.stores s
WHERE o.store_id IS NULL
  AND s.user_id = o.owner_id;

-- Auto-set store_id from owner on insert/update
CREATE OR REPLACE FUNCTION public.sync_order_store_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.store_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    SELECT id INTO NEW.store_id
    FROM public.stores
    WHERE user_id = NEW.owner_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_sync_store_id ON public.orders;
CREATE TRIGGER order_sync_store_id
  BEFORE INSERT OR UPDATE OF owner_id ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_store_id();
