-- v67: Tighten write-path RPC grants (service_role only for batch processors)

REVOKE ALL ON FUNCTION public.process_order_side_effects_batch(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_order_side_effects_batch(INT) TO service_role;

REVOKE ALL ON FUNCTION public.platform_write_path_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_write_path_audit() TO service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (67, 'write_path: revoke side-effects + audit RPC from anon/authenticated')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
