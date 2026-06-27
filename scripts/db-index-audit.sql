-- Phase 3 index audit — run via: supabase db query --linked -f scripts/db-index-audit.sql
SELECT jsonb_build_object(
  'audited_at', now(),
  'schema_version', (SELECT max(version) FROM public.platform_schema_version),
  'tables', (
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.tablename), '[]'::jsonb)
    FROM (
      SELECT
        c.relname AS tablename,
        c.reltuples::bigint AS est_rows,
        pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
        (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid) AS index_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
      ORDER BY c.reltuples DESC
    ) t
  ),
  'indexes', (
    SELECT COALESCE(jsonb_agg(row_to_json(i) ORDER BY i.tablename, i.indexname), '[]'::jsonb)
    FROM (
      SELECT
        t.relname AS tablename,
        ic.relname AS indexname,
        pg_get_indexdef(i.indexrelid) AS indexdef,
        i.indisunique AS is_unique,
        i.indisprimary AS is_primary,
        COALESCE(s.idx_scan, 0) AS idx_scan,
        COALESCE(s.idx_tup_read, 0) AS idx_tup_read,
        pg_size_pretty(pg_relation_size(ic.oid)) AS index_size
      FROM pg_index i
      JOIN pg_class ic ON ic.oid = i.indexrelid
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = i.indexrelid
      WHERE n.nspname = 'public'
    ) i
  ),
  'unused_indexes', (
    SELECT COALESCE(jsonb_agg(row_to_json(u) ORDER BY u.tablename, u.indexname), '[]'::jsonb)
    FROM (
      SELECT
        ui.relname AS indexname,
        ut.relname AS tablename,
        pg_get_indexdef(i.indexrelid) AS indexdef,
        s.idx_scan
      FROM pg_stat_user_indexes s
      JOIN pg_class ui ON ui.oid = s.indexrelid
      JOIN pg_class ut ON ut.oid = s.relid
      JOIN pg_index i ON i.indexrelid = s.indexrelid
      WHERE s.schemaname = 'public'
        AND s.idx_scan = 0
        AND NOT i.indisprimary
        AND NOT i.indisunique
    ) u
  ),
  'duplicate_candidates', (
    SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::jsonb)
    FROM (
      SELECT
        a.indrelid::regclass AS tablename,
        ia.relname AS index_a,
        ib.relname AS index_b,
        pg_get_indexdef(a.indexrelid) AS def_a,
        pg_get_indexdef(b.indexrelid) AS def_b
      FROM pg_index a
      JOIN pg_index b ON a.indrelid = b.indrelid AND a.indexrelid < b.indexrelid
      JOIN pg_class ia ON ia.oid = a.indexrelid
      JOIN pg_class ib ON ib.oid = b.indexrelid
      JOIN pg_namespace n ON n.oid = ia.relnamespace
      WHERE n.nspname = 'public'
        AND pg_get_indexdef(a.indexrelid) = pg_get_indexdef(b.indexrelid)
      LIMIT 20
    ) d
  )
) AS audit;
