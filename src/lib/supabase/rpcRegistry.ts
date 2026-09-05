/**
 * Canonical PostgreSQL RPC registry — single source of truth for app ↔ production alignment.
 * Optional/deferred RPCs must be probed via schemaCapabilities before calling.
 */
import { CHECKOUT_CREATE_RPC } from '@/lib/checkout/checkoutContract';
import { INVENTORY_MODEL } from '@/lib/inventory/inventoryArchitecture';

export type RpcDomain =
  | 'checkout'
  | 'orders'
  | 'inventory'
  | 'storefront'
  | 'analytics'
  | 'dashboard'
  | 'background'
  | 'admin';

export type RpcStatus = 'required' | 'optional' | 'deferred' | 'service_role';

export type RpcDefinition = {
  name: string;
  domain: RpcDomain;
  status: RpcStatus;
  /** Canonical migration that defines production behavior */
  migration: string;
  notes?: string;
};

/** RPCs the application requires in production — missing = degraded or broken UX */
export const REQUIRED_RPCS: RpcDefinition[] = [
  {
    name: CHECKOUT_CREATE_RPC,
    domain: 'checkout',
    status: 'required',
    migration: '20260906000002',
    notes: '13-param overload with p_store_slug',
  },
  {
    name: 'get_checkout_preflight_bundle',
    domain: 'checkout',
    status: 'required',
    migration: '20260626000006',
  },
  {
    name: 'get_order_by_idempotency_key',
    domain: 'checkout',
    status: 'required',
    migration: '20260625000017',
  },
  {
    name: 'increment_product_stock',
    domain: 'inventory',
    status: 'required',
    migration: '20260906000003',
    notes: '5-param with p_min_stock_level',
  },
  {
    name: 'merchant_inventory_summary',
    domain: 'inventory',
    status: 'required',
    migration: '20260906000003',
  },
  {
    name: 'batch_restock_products',
    domain: 'inventory',
    status: 'required',
    migration: '20260906000003',
  },
  {
    name: 'list_merchant_inventory_movements',
    domain: 'inventory',
    status: 'required',
    migration: '20260906000003',
  },
  {
    name: 'audit_merchant_inventory_integrity',
    domain: 'inventory',
    status: 'required',
    migration: '20260625000053',
  },
  {
    name: 'get_storefront_page_bundle',
    domain: 'storefront',
    status: 'required',
    migration: '20260902120000',
  },
  {
    name: 'get_store_products_page',
    domain: 'storefront',
    status: 'required',
    migration: '20260626000005',
  },
  {
    name: 'track_store_visit_by_slug',
    domain: 'analytics',
    status: 'required',
    migration: '20260829000001',
  },
  {
    name: 'track_product_view_by_slug',
    domain: 'analytics',
    status: 'required',
    migration: '20260902160000',
  },
  {
    name: 'get_dashboard_statistics_batch',
    domain: 'dashboard',
    status: 'required',
    migration: '20260720000002',
  },
  {
    name: 'get_store_statistics',
    domain: 'dashboard',
    status: 'required',
    migration: '20260625000065',
    notes: 'Range overload (p_start, p_end) only',
  },
  {
    name: 'list_merchant_orders',
    domain: 'orders',
    status: 'required',
    migration: '20260629000001',
  },
  {
    name: 'update_merchant_order_status',
    domain: 'orders',
    status: 'required',
    migration: '20260626000002',
  },
  {
    name: 'process_order_side_effects_batch',
    domain: 'background',
    status: 'required',
    migration: '20260905000004',
  },
  {
    name: 'side_effects_outbox_backlog_health',
    domain: 'background',
    status: 'required',
    migration: '20260905000004',
  },
];

/** Optional RPCs — app probes and falls back when absent */
export const OPTIONAL_RPCS: RpcDefinition[] = [
  {
    name: 'get_dashboard_kpis_light',
    domain: 'dashboard',
    status: 'optional',
    migration: '20260626000005',
    notes: 'Falls back to get_dashboard_statistics_batch',
  },
  {
    name: 'get_dashboard_workflow_counts',
    domain: 'dashboard',
    status: 'optional',
    migration: '20260626000005',
    notes: 'Falls back to batch workflow_counts',
  },
  {
    name: 'get_statistics_page_bundle',
    domain: 'dashboard',
    status: 'optional',
    migration: '20260625000028',
    notes: 'Falls back to get_store_statistics + client queries',
  },
  {
    name: 'flush_merchant_analytics_buffer',
    domain: 'analytics',
    status: 'optional',
    migration: '20260906000004',
    notes: 'Background flush for merchant analytics buffer',
  },
  {
    name: 'process_webhook_outbox_worker_start',
    domain: 'background',
    status: 'service_role',
    migration: '20260906000004',
    notes: 'Edge worker bundle; falls back to separate RPCs',
  },
  {
    name: 'platform_monitoring_observability_audit',
    domain: 'background',
    status: 'deferred',
    migration: '20260902000011',
    notes: 'Phase 9 monitoring — probe before calling',
  },
];

/** Deferred premium RPCs — gated by hasWarehouseInventory / hasInventoryPageBundleRpc */
export const DEFERRED_RPCS: RpcDefinition[] = [
  {
    name: 'get_merchant_inventory_page_bundle',
    domain: 'inventory',
    status: 'deferred',
    migration: '20260902000004',
    notes: 'Phase 3.5 bundle — inventory page uses product queries fallback',
  },
  {
    name: 'ensure_default_warehouse',
    domain: 'inventory',
    status: 'deferred',
    migration: '20260728000001',
  },
  {
    name: 'merchant_inventory_forecast',
    domain: 'inventory',
    status: 'deferred',
    migration: '20260728000001',
  },
  {
    name: 'merchant_abc_analysis',
    domain: 'inventory',
    status: 'deferred',
    migration: '20260728000001',
  },
  {
    name: 'lookup_product_by_barcode',
    domain: 'inventory',
    status: 'deferred',
    migration: '20260728000001',
  },
  {
    name: 'transfer_warehouse_stock',
    domain: 'inventory',
    status: 'deferred',
    migration: '20260728000001',
  },
];

export const ALL_RPC_DEFINITIONS = [...REQUIRED_RPCS, ...OPTIONAL_RPCS, ...DEFERRED_RPCS];

export const INVENTORY_ARCHITECTURE = INVENTORY_MODEL;

export function getRpcDefinition(name: string): RpcDefinition | undefined {
  return ALL_RPC_DEFINITIONS.find((r) => r.name === name);
}

export function isDeferredRpc(name: string): boolean {
  return DEFERRED_RPCS.some((r) => r.name === name);
}

export function isRequiredRpc(name: string): boolean {
  return REQUIRED_RPCS.some((r) => r.name === name);
}
