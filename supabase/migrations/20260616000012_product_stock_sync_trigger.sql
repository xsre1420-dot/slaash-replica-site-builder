-- Keep stock_quantity aligned with variant rows when variants hold the inventory truth.

CREATE OR REPLACE FUNCTION public.sync_product_stock_on_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_variant_sum INT;
BEGIN
  v_variant_sum := public.product_variant_stock_sum(NEW.variants);

  IF v_variant_sum > 0 AND COALESCE(NEW.stock_quantity, 0) < v_variant_sum THEN
    NEW.stock_quantity := v_variant_sum;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_stock_on_write ON public.products;

CREATE TRIGGER trg_sync_product_stock_on_write
  BEFORE INSERT OR UPDATE OF stock_quantity, variants ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_stock_on_write();
