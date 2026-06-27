-- Analytics hardening: block direct store_visits INSERT (RPC-only path)

DROP POLICY IF EXISTS "Restaurant owners can insert their own store visits" ON public.store_visits;
DROP POLICY IF EXISTS "Restaurant owners can create store visits" ON public.store_visits;
DROP POLICY IF EXISTS "Store owners can insert their own store visits" ON public.store_visits;

-- No public INSERT policy: visits are written only by track_store_visit_by_slug (SECURITY DEFINER)
