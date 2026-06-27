-- FK index audit — run: supabase db query --linked -f scripts/db-fk-audit.sql
SELECT public.platform_fk_index_audit() AS audit;
