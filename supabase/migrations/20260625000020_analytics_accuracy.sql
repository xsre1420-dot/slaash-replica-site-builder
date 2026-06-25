-- v30: Analytics accuracy — rollup revenue adjustments + completed amount edits

CREATE OR REPLACE FUNCTION public.trg_orders_daily_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stat_date DATE;
  v_revenue_delta NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.upsert_store_daily_order_stats(
      NEW.owner_id,
      (NEW.created_at AT TIME ZONE 'UTC')::DATE,
      COALESCE(NEW.status, 'pending'),
      COALESCE(NEW.total_amount, 0),
      1
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.upsert_store_daily_order_stats(
      OLD.owner_id,
      (OLD.created_at AT TIME ZONE 'UTC')::DATE,
      OLD.status,
      COALESCE(OLD.total_amount, 0),
      -1
    );
    PERFORM public.upsert_store_daily_order_stats(
      NEW.owner_id,
      (NEW.created_at AT TIME ZONE 'UTC')::DATE,
      COALESCE(NEW.status, 'pending'),
      COALESCE(NEW.total_amount, 0),
      1
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'completed'
     AND NEW.status = 'completed'
     AND COALESCE(OLD.total_amount, 0) IS DISTINCT FROM COALESCE(NEW.total_amount, 0) THEN
    v_stat_date := (NEW.created_at AT TIME ZONE 'UTC')::DATE;
    v_revenue_delta := COALESCE(NEW.total_amount, 0) - COALESCE(OLD.total_amount, 0);

    UPDATE public.store_daily_stats
    SET completed_revenue = GREATEST(0, completed_revenue + v_revenue_delta),
        updated_at = NOW()
    WHERE owner_id = NEW.owner_id
      AND stat_date = v_stat_date;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_daily_stats_trg ON public.orders;
CREATE TRIGGER orders_daily_stats_trg
  AFTER INSERT OR UPDATE OF status, total_amount ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_orders_daily_stats();

INSERT INTO public.platform_schema_version (version, notes)
VALUES (30, 'analytics_accuracy: rollup revenue delta on completed amount edits')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
