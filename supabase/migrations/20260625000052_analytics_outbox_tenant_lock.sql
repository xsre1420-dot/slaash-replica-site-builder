-- v52: Harden analytics_event_outbox — no direct client writes; anon/authenticated SELECT only via RLS deny

ALTER TABLE IF EXISTS public.analytics_event_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can view their analytics events" ON public.analytics_event_outbox;
CREATE POLICY "Store owners can view their analytics events"
  ON public.analytics_event_outbox FOR SELECT
  USING (owner_id = auth.uid());

-- Inserts only via SECURITY DEFINER RPCs (track_store_visit_by_slug, track_product_view_by_slug)
REVOKE ALL ON TABLE public.analytics_event_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.analytics_event_outbox TO authenticated;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (52, 'analytics_event_outbox: RLS hardening, revoke direct table grants')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
