# SQL Query Inventory — Phase 1

Generated: 2026-06-25T21:03:55.475Z

## Summary

| Metric | Value |
|--------|-------|
| Unique RPCs | 70 |
| Unique tables (PostgREST) | 18 |
| Total call sites | 177 |
| Critical-path RPCs | get_storefront_page_bundle, get_store_products_page, get_checkout_products_by_ids, create_order_with_stock_deduction |

## RPC Inventory (by priority)

| RPC | Tier | Est/session | Domain | Call sites | Locations |
|-----|------|-------------|--------|------------|-----------|
| get_storefront_page_bundle | critical | 1 | storefront | 2 | src/services/storefrontProductService.ts, supabase/functions/get-store-products/index.ts |
| get_store_products_page | critical | 2 | storefront | 2 | src/services/storefrontProductService.ts, supabase/functions/get-store-products/index.ts |
| get_checkout_products_by_ids | critical | 1 | checkout | 1 | src/services/storefrontProductService.ts |
| create_order_with_stock_deduction | critical | 0.05 | checkout | 1 | src/services/orderService.ts |
| get_store_meta | high | 2 | storefront | 3 | src/lib/tenantStoreRegistry.ts, src/services/storefrontProductService.ts, supabase/functions/get-store-products/index.ts |
| list_merchant_orders | high | 2 | dashboard | 1 | src/services/orderService.ts |
| get_owner_products_page | high | 3 | dashboard | 1 | src/services/merchantProductCatalogService.ts |
| get_dashboard_statistics_batch | high | 1 | dashboard | 1 | src/services/dashboardStatsService.ts |
| increment_product_stock | medium | 0.2 | inventory | 3 | src/services/inventoryService.ts |
| get_store_statistics | medium | 1 | analytics | 2 | src/services/dashboardStatsService.ts, src/services/statisticsService.ts |
| get_statistics_page_bundle | medium | 1 | analytics | 1 | src/services/statisticsService.ts |
| count_merchant_orders_by_workflow | medium | 1 | dashboard | 1 | src/services/orderService.ts |
| get_merchant_product_by_id | medium | 2 | dashboard | 1 | src/services/merchantProductCatalogService.ts |
| platform_health_check | low | 0.01 | ops | 1 | src/services/platformHealthService.ts |
| finalize_order_webhook_delivery | unknown | 0 | misc | 3 | supabase/functions/process-order-webhook-outbox/index.ts |
| admin_list_leads | unknown | 0 | misc | 2 | src/services/leadAdminService.ts |
| get_suggested_products_for_store | unknown | 0 | misc | 1 | src/services/suggestedProductsService.ts |
| get_my_subscription | unknown | 0 | misc | 1 | src/services/subscriptionService.ts |
| get_store_for_user | unknown | 0 | misc | 1 | src/services/storeService.ts |
| get_owner_bootstrap | unknown | 0 | misc | 1 | src/services/storeService.ts |
| list_public_store_slugs | unknown | 0 | misc | 1 | src/services/storeService.ts |
| get_approved_product_reviews | unknown | 0 | misc | 1 | src/services/storefrontReviewService.ts |
| submit_product_review_for_store | unknown | 0 | misc | 1 | src/services/storefrontReviewService.ts |
| get_store_policies | unknown | 0 | misc | 1 | src/services/storefrontProductService.ts |
| get_owner_checkout_products_by_ids | unknown | 0 | misc | 1 | src/services/storefrontProductService.ts |
| get_store_products_by_slug | unknown | 0 | misc | 1 | src/services/storefrontProductService.ts |
| get_store_product_by_id | unknown | 0 | misc | 1 | src/services/storefrontProductService.ts |
| bump_storefront_cache_version | unknown | 0 | misc | 1 | src/services/storefrontProductService.ts |
| get_order_items_for_statistics | unknown | 0 | misc | 1 | src/services/statisticsService.ts |
| get_merchant_product_reviews | unknown | 0 | misc | 1 | src/services/reviewService.ts |
| approve_product_review | unknown | 0 | misc | 1 | src/services/reviewService.ts |
| record_product_idempotency | unknown | 0 | misc | 1 | src/services/productsCrudService.ts |
| get_order_payment_summary | unknown | 0 | misc | 1 | src/services/paymentService.ts |
| record_order_refund | unknown | 0 | misc | 1 | src/services/paymentService.ts |
| record_order_chargeback | unknown | 0 | misc | 1 | src/services/paymentService.ts |
| attach_order_marketing_attribution | unknown | 0 | misc | 1 | src/services/orderService.ts |
| get_store_marketing_public | unknown | 0 | misc | 1 | src/services/marketingService.ts |
| get_store_marketing_for_owner | unknown | 0 | misc | 1 | src/services/marketingService.ts |
| submit_access_lead | unknown | 0 | misc | 1 | src/services/leadAdminService.ts |
| admin_get_lead | unknown | 0 | misc | 1 | src/services/leadAdminService.ts |
| admin_update_lead | unknown | 0 | misc | 1 | src/services/leadAdminService.ts |
| admin_unread_leads_count | unknown | 0 | misc | 1 | src/services/leadAdminService.ts |
| admin_leads_stats | unknown | 0 | misc | 1 | src/services/leadAdminService.ts |
| admin_mark_lead_contacted | unknown | 0 | misc | 1 | src/services/leadAdminService.ts |
| admin_list_subscriptions | unknown | 0 | misc | 1 | src/services/leadAdminService.ts |
| admin_upsert_subscription | unknown | 0 | misc | 1 | src/services/leadAdminService.ts |
| is_platform_admin | unknown | 0 | misc | 1 | src/services/leadAdminService.ts |
| admin_generate_access_code | unknown | 0 | misc | 1 | src/services/leadAdminService.ts |
| admin_list_lead_access_codes | unknown | 0 | misc | 1 | src/services/leadAdminService.ts |
| audit_merchant_inventory_integrity | unknown | 0 | misc | 1 | src/services/inventoryService.ts |
| get_storefront_footer_products | unknown | 0 | misc | 1 | src/services/footerSuggestedProductsService.ts |
| calculate_delivery_fee | unknown | 0 | misc | 1 | src/services/deliveryService.ts |
| calculate_delivery_fee_by_slug | unknown | 0 | misc | 1 | src/services/deliveryService.ts |
| get_order_shipment | unknown | 0 | misc | 1 | src/services/deliveryService.ts |
| update_shipment_status | unknown | 0 | misc | 1 | src/services/deliveryService.ts |
| mark_delivery_failed | unknown | 0 | misc | 1 | src/services/deliveryService.ts |
| retry_failed_delivery | unknown | 0 | misc | 1 | src/services/deliveryService.ts |
| validate_store_coupon_by_slug | unknown | 0 | misc | 1 | src/services/couponService.ts |
| validate_store_coupon | unknown | 0 | misc | 1 | src/services/couponService.ts |
| get_order_by_idempotency_key | unknown | 0 | misc | 1 | src/services/checkoutRecoveryService.ts |
| get_background_jobs_status | unknown | 0 | misc | 1 | src/services/backgroundJobsService.ts |
| retry_order_webhook_events | unknown | 0 | misc | 1 | src/services/backgroundJobsService.ts |
| audit_merchant_analytics_health | unknown | 0 | misc | 1 | src/services/analyticsHealthService.ts |
| claim_order_webhook_outbox_batch | unknown | 0 | misc | 1 | supabase/functions/process-order-webhook-outbox/index.ts |
| process_product_import_batch | unknown | 0 | misc | 1 | supabase/functions/process-import-jobs/index.ts |
| process_payment_webhook_event | unknown | 0 | misc | 1 | supabase/functions/payment-webhook/index.ts |
| verify_order_for_meta_conversion | unknown | 0 | misc | 1 | supabase/functions/meta-conversions/index.ts |
| mark_meta_conversion_sent | unknown | 0 | misc | 1 | supabase/functions/meta-conversions/index.ts |
| get_storefront_cache_version | unknown | 0 | misc | 1 | supabase/functions/get-store-products/index.ts |
| check_rpc_rate_limit | unknown | 0 | misc | 1 | supabase/functions/get-store-products/index.ts |

## PostgREST Table Access

| Table | Call sites | Key filters / joins |
|-------|------------|---------------------|
| products | 28 | filters: owner_id, archived_at, is_active; joins: stores, categories |
| store_settings | 14 | filters: owner_id, store_slug; joins: stores |
| orders | 9 | filters: owner_id, status, payment_status; joins: order_items, order_refunds |
| stores | 7 | filters: —; joins: — |
| product_reviews | 7 | filters: owner_id, is_approved; joins: products |
| categories | 5 | filters: owner_id; joins:  |
| suggested_products | 4 | filters: —; joins: — |
| storefront_footer_products | 4 | filters: —; joins: — |
| marketing_coupons | 4 | filters: —; joins: — |
| marketing_settings | 3 | filters: —; joins: — |
| subscriptions | 3 | filters: —; joins: — |
| customers | 2 | filters: owner_id, phone; joins:  |
| merchant_access_codes | 2 | filters: —; joins: — |
| store_visits | 1 | filters: owner_id, created_at; joins:  |
| order_items | 1 | filters: owner_id, order_id; joins: orders, products |
| inventory_movements | 1 | filters: owner_id, product_id; joins: products |
| profiles | 1 | filters: —; joins: — |
| leads | 1 | filters: —; joins: — |
