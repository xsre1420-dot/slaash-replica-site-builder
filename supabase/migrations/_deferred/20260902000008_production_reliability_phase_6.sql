-- v112: Phase 6 — production reliability (client-side hardening + audit marker).
-- Order idempotency, webhook dedup, and atomic checkout RPCs remain in v16/v35/v109.

INSERT INTO public.platform_schema_version (version, notes)
VALUES (
  121,
  'Phase 6: production reliability — checkout timeouts, retry budget, edge timeouts, graceful failure isolation'
)
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
