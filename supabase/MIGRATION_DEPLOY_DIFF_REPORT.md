# Migration Deploy Diff Report

**Generated:** 2026-06-25T06:14:14.146Z
**Project:** https://mpifosptgoxvroblrrte.supabase.co
**Source:** `supabase migration list --linked` (Supabase CLI remote migration history)

## Counts

| Metric | Count |
|--------|------:|
| Local migration files (`supabase/migrations/*.sql`) | **145** |
| Applied on linked remote | **114** |
| **NOT applied on linked remote** | **31** |
| Tables in live schema (`types.generated.ts`) | 37 |
| RPCs in live schema (`types.generated.ts`) | 95 |

**Last deployed migration (remote):** `20260625000016`
**Latest local migration (disk):** `20260625000057`

## Migrations on disk NOT deployed to remote (31)

- `20260625000017_tenant_isolation_security.sql`
- `20260625000018_order_creation_reliability.sql`
- `20260625000019_postgresql_performance_audit.sql`
- `20260625000020_analytics_accuracy.sql`
- `20260625000021_security_hardening.sql`
- `20260625000022_scale_500_to_1000.sql`
- `20260625000023_schema_code_sync.sql`
- `20260625000024_product_lifecycle_sync.sql`
- `20260625000025_order_reliability.sql`
- `20260625000026_saas_scale_performance.sql`
- `20260625000027_tenant_isolation_reapply.sql`
- `20260625000028_analytics_optimization.sql`
- `20260625000029_security_audit_fixes.sql`
- `20260625000030_scale_performance_v40.sql`
- `20260625000041_storefront_load_bottlenecks.sql`
- `20260625000042_hot_table_optimizations.sql`
- `20260625000043_write_amplification_reduction.sql`
- `20260625000044_payload_optimization.sql`
- `20260625000045_transaction_integrity.sql`
- `20260625000046_transaction_integrity_v2.sql`
- `20260625000047_checkout_variant_consolidation.sql`
- `20260625000048_over_fetching_reduction.sql`
- `20260625000049_index_query_optimization.sql`
- `20260625000050_merchant_product_by_id.sql`
- `20260625000051_analytics_event_buffer.sql`
- `20260625000052_analytics_outbox_tenant_lock.sql`
- `20260625000053_inventory_architecture_audit.sql`
- `20260625000054_analytics_hot_path_hardening.sql`
- `20260625000055_background_processing.sql`
- `20260625000056_edge_cache_versioning.sql`
- `20260625000057_storefront_payload_optimization.sql`

## Tables introduced in undeployed migrations — missing on live

- `analytics_event_outbox` (from `20260625000051_analytics_event_buffer.sql`)
- `store_visitor_daily_keys` (from `20260625000022_scale_500_to_1000.sql`)

## RPCs in undeployed migrations — missing on live (probed via PostgREST)

- `_dashboard_period_json` (from `20260625000026_saas_scale_performance.sql`)
- `_resolve_store_owner_by_slug` (from `20260625000022_scale_500_to_1000.sql`)
- `audit_merchant_analytics_health` (from `20260625000054_analytics_hot_path_hardening.sql`)
- `audit_merchant_inventory_integrity` (from `20260625000053_inventory_architecture_audit.sql`)
- `bump_storefront_cache_version` (from `20260625000056_edge_cache_versioning.sql`)
- `checkout_resolve_duplicate_order` (from `20260625000027_tenant_isolation_reapply.sql`)
- `claim_order_webhook_outbox_batch` (from `20260625000055_background_processing.sql`)
- `create_order_with_stock_deduction` (from `20260625000047_checkout_variant_consolidation.sql`)
- `finalize_order_webhook_delivery` (from `20260625000055_background_processing.sql`)
- `get_analytics_pipeline_status` (from `20260625000054_analytics_hot_path_hardening.sql`)
- `get_background_jobs_status` (from `20260625000055_background_processing.sql`)
- `get_checkout_products_by_ids` (from `20260625000021_security_hardening.sql`)
- `get_dashboard_statistics_batch` (from `20260625000030_scale_performance_v40.sql`)
- `get_merchant_product_by_id` (from `20260625000050_merchant_product_by_id.sql`)
- `get_order_by_idempotency_key` (from `20260625000017_tenant_isolation_security.sql`)
- `get_order_items_for_statistics` (from `20260625000028_analytics_optimization.sql`)
- `get_owner_bootstrap` (from `20260625000044_payload_optimization.sql`)
- `get_owner_checkout_products_by_ids` (from `20260625000021_security_hardening.sql`)
- `get_owner_products_page` (from `20260625000049_index_query_optimization.sql`)
- `get_statistics_page_bundle` (from `20260625000028_analytics_optimization.sql`)
- `get_store_bundle` (from `20260625000021_security_hardening.sql`)
- `get_store_for_user` (from `20260625000027_tenant_isolation_reapply.sql`)
- `get_store_meta` (from `20260625000057_storefront_payload_optimization.sql`)
- `get_store_policies` (from `20260625000057_storefront_payload_optimization.sql`)
- `get_store_product_by_id` (from `20260625000021_security_hardening.sql`)
- `get_store_products_by_slug` (from `20260625000026_saas_scale_performance.sql`)
- `get_store_products_page` (from `20260625000057_storefront_payload_optimization.sql`)
- `get_store_statistics` (from `20260625000028_analytics_optimization.sql`)
- `get_storefront_cache_version` (from `20260625000056_edge_cache_versioning.sql`)
- `get_storefront_page_bundle` (from `20260625000057_storefront_payload_optimization.sql`)
- `increment_product_stock` (from `20260625000046_transaction_integrity_v2.sql`)
- `is_payment_method_allowed` (from `20260625000017_tenant_isolation_security.sql`)
- `is_username_available` (from `20260625000029_security_audit_fixes.sql`)
- `is_valid_store_visit` (from `20260625000041_storefront_load_bottlenecks.sql`)
- `list_merchant_orders` (from `20260625000049_index_query_optimization.sql`)
- `mark_meta_conversion_sent` (from `20260625000021_security_hardening.sql`)
- `process_analytics_event_buffer` (from `20260625000051_analytics_event_buffer.sql`)
- `prune_analytics_event_outbox` (from `20260625000051_analytics_event_buffer.sql`)
- `publish_owner_product` (from `20260625000024_product_lifecycle_sync.sql`)
- `record_initial_stock_movements` (from `20260625000045_transaction_integrity.sql`)
- `record_product_initial_stock` (from `20260625000045_transaction_integrity.sql`)
- `recover_stale_webhook_processing` (from `20260625000055_background_processing.sql`)
- `retry_order_webhook_events` (from `20260625000055_background_processing.sql`)
- `storefront_compact_variants` (from `20260625000057_storefront_payload_optimization.sql`)
- `storefront_product_card_json` (from `20260625000057_storefront_payload_optimization.sql`)
- `storefront_product_grid_json` (from `20260625000057_storefront_payload_optimization.sql`)
- `storefront_store_shell_json` (from `20260625000057_storefront_payload_optimization.sql`)
- `tenant_row_owned` (from `20260625000017_tenant_isolation_security.sql`)
- `track_product_view_by_slug` (from `20260625000054_analytics_hot_path_hardening.sql`)
- `track_store_visit_by_slug` (from `20260625000054_analytics_hot_path_hardening.sql`)
- `trg_bump_storefront_cache_on_category` (from `20260625000056_edge_cache_versioning.sql`)
- `trg_bump_storefront_cache_on_product` (from `20260625000056_edge_cache_versioning.sql`)
- `trg_bump_storefront_cache_on_settings` (from `20260625000056_edge_cache_versioning.sql`)
- `trg_orders_daily_stats` (from `20260625000042_hot_table_optimizations.sql`)
- `trg_visits_daily_stats` (from `20260625000042_hot_table_optimizations.sql`)
- `verify_order_for_meta_conversion` (from `20260625000021_security_hardening.sql`)

## Columns introduced in undeployed migrations — missing from live types

- `store_settings.order_webhook_url` — `20260625000055_background_processing.sql` (column_not_in_types)
- `order_webhook_outbox.next_attempt_at` — `20260625000055_background_processing.sql` (column_not_in_types)
- `store_settings.storefront_cache_version` — `20260625000056_edge_cache_versioning.sql` (column_not_in_types)

## Conclusion

**YES — the local codebase is ahead of the deployed Supabase database.**

Evidence: **31** migration files exist locally with **no matching remote entry** in Supabase migration history. Last remote migration: **20260625000016**. Latest local: **20260625000057**.