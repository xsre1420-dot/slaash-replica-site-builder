/**
 * Read consistency & category registry — single source of truth for read routing.
 * Enables replica activation via env without business-logic changes.
 */
export type ReadCategory =
  | 'critical'
  | 'cached'
  | 'analytics'
  | 'dashboard'
  | 'storefront'
  | 'background'
  | 'merchant'
  | 'admin';

/** How stale a read may be when served from a replica. */
export type ReadConsistency = 'requires_primary' | 'replica_safe' | 'eventually_consistent';

export type ReadOperationSpec = {
  rpc: string;
  category: ReadCategory;
  consistency: ReadConsistency;
  description: string;
  /** Prefer edge CDN before replica when storefront public read. */
  edgeEligible?: boolean;
  /** Application L1 cache may serve before hitting DB. */
  clientCacheEligible?: boolean;
};

const specs: ReadOperationSpec[] = [
  // --- Critical / checkout (PRIMARY ONLY) ---
  { rpc: 'get_order_by_idempotency_key', category: 'critical', consistency: 'requires_primary', description: 'Checkout idempotency recovery' },
  { rpc: 'get_checkout_preflight_bundle', category: 'critical', consistency: 'requires_primary', description: 'Checkout stock/pricing preflight' },
  { rpc: 'get_checkout_products_by_ids', category: 'critical', consistency: 'requires_primary', description: 'Checkout cart product validation' },
  { rpc: 'get_owner_checkout_products_by_ids', category: 'critical', consistency: 'requires_primary', description: 'Merchant checkout product lookup' },
  { rpc: 'validate_store_coupon_by_slug', category: 'critical', consistency: 'requires_primary', description: 'Checkout coupon validation' },
  { rpc: 'validate_store_coupon', category: 'critical', consistency: 'requires_primary', description: 'Checkout coupon validation' },
  { rpc: 'get_order_payment_summary', category: 'critical', consistency: 'requires_primary', description: 'Payment verification' },
  { rpc: 'get_my_subscription', category: 'critical', consistency: 'requires_primary', description: 'Active subscription state' },
  { rpc: 'get_store_for_user', category: 'critical', consistency: 'requires_primary', description: 'Session store resolution' },
  { rpc: 'audit_merchant_inventory_integrity', category: 'critical', consistency: 'requires_primary', description: 'Live inventory integrity audit' },
  { rpc: 'is_platform_admin', category: 'admin', consistency: 'requires_primary', description: 'Admin gate' },

  // --- Storefront (replica-ready) ---
  { rpc: 'get_storefront_page_bundle', category: 'storefront', consistency: 'eventually_consistent', description: 'Homepage bundle', edgeEligible: true, clientCacheEligible: true },
  { rpc: 'get_store_products_page', category: 'storefront', consistency: 'eventually_consistent', description: 'Product listing / categories', edgeEligible: true, clientCacheEligible: true },
  { rpc: 'get_store_meta', category: 'storefront', consistency: 'eventually_consistent', description: 'Store metadata', edgeEligible: true, clientCacheEligible: true },
  { rpc: 'get_store_products_by_slug', category: 'storefront', consistency: 'eventually_consistent', description: 'Products by store slug', clientCacheEligible: true },
  { rpc: 'get_store_product_by_id', category: 'storefront', consistency: 'eventually_consistent', description: 'Product detail page', clientCacheEligible: true },
  { rpc: 'get_store_policies', category: 'storefront', consistency: 'eventually_consistent', description: 'Policies pages', clientCacheEligible: true },
  { rpc: 'get_storefront_featured_products', category: 'storefront', consistency: 'eventually_consistent', description: 'Featured / collections', clientCacheEligible: true },
  { rpc: 'get_storefront_footer_products', category: 'storefront', consistency: 'eventually_consistent', description: 'Footer recommendations', clientCacheEligible: true },
  { rpc: 'get_suggested_products_for_store', category: 'storefront', consistency: 'eventually_consistent', description: 'Product recommendations', clientCacheEligible: true },
  { rpc: 'get_approved_product_reviews', category: 'storefront', consistency: 'eventually_consistent', description: 'Public product reviews', clientCacheEligible: true },
  { rpc: 'get_store_marketing_public', category: 'storefront', consistency: 'eventually_consistent', description: 'Public marketing pixels', clientCacheEligible: true },
  { rpc: 'list_public_store_slugs', category: 'storefront', consistency: 'replica_safe', description: 'Store directory / sitemap' },

  // --- Dashboard / analytics reads ---
  { rpc: 'get_dashboard_statistics_batch', category: 'dashboard', consistency: 'replica_safe', description: 'Dashboard KPI batch', clientCacheEligible: true },
  { rpc: 'get_dashboard_kpis_light', category: 'dashboard', consistency: 'replica_safe', description: 'Light dashboard KPIs', clientCacheEligible: true },
  { rpc: 'get_dashboard_workflow_counts', category: 'dashboard', consistency: 'replica_safe', description: 'Order workflow tab counts', clientCacheEligible: true },
  { rpc: 'get_statistics_page_bundle', category: 'dashboard', consistency: 'replica_safe', description: 'Statistics page bundle', clientCacheEligible: true },
  { rpc: 'get_store_statistics', category: 'dashboard', consistency: 'replica_safe', description: 'Period statistics', clientCacheEligible: true },
  { rpc: 'get_order_items_for_statistics', category: 'dashboard', consistency: 'replica_safe', description: 'Historical order items for reports' },
  { rpc: 'get_merchant_order_stats_batch', category: 'dashboard', consistency: 'replica_safe', description: 'Order stats batch' },
  { rpc: 'list_merchant_orders', category: 'dashboard', consistency: 'replica_safe', description: 'Historical orders list' },
  { rpc: 'count_merchant_orders_by_workflow', category: 'dashboard', consistency: 'replica_safe', description: 'Order workflow counts' },
  { rpc: 'audit_merchant_analytics_health', category: 'analytics', consistency: 'replica_safe', description: 'Analytics health audit' },

  // --- Merchant catalog ---
  { rpc: 'get_owner_products_page', category: 'merchant', consistency: 'replica_safe', description: 'Merchant product catalog page' },
  { rpc: 'get_merchant_product_by_id', category: 'merchant', consistency: 'replica_safe', description: 'Merchant product detail read' },
  { rpc: 'get_merchant_product_reviews', category: 'merchant', consistency: 'replica_safe', description: 'Merchant review moderation list' },
  { rpc: 'get_owner_bootstrap', category: 'merchant', consistency: 'replica_safe', description: 'Owner bootstrap bundle', clientCacheEligible: true },
  { rpc: 'get_store_marketing_for_owner', category: 'merchant', consistency: 'replica_safe', description: 'Owner marketing settings read' },

  // --- Background / platform audits ---
  { rpc: 'get_background_jobs_status', category: 'background', consistency: 'replica_safe', description: 'Worker queue depth monitor' },
  { rpc: 'platform_health_check', category: 'background', consistency: 'replica_safe', description: 'Platform health probe' },
  { rpc: 'platform_lifecycle_audit', category: 'background', consistency: 'replica_safe', description: 'Data lifecycle audit' },
  { rpc: 'platform_internals_audit', category: 'background', consistency: 'replica_safe', description: 'PostgreSQL internals audit' },
  { rpc: 'platform_database_resource_audit', category: 'background', consistency: 'replica_safe', description: 'Connection resource audit' },
  { rpc: 'platform_connection_pool_recommendations', category: 'background', consistency: 'replica_safe', description: 'Pool recommendations' },
  { rpc: 'platform_distributed_scaling_audit', category: 'background', consistency: 'replica_safe', description: 'Distributed scaling audit' },
  { rpc: 'platform_read_replica_audit', category: 'background', consistency: 'replica_safe', description: 'Read replica readiness audit' },
  { rpc: 'platform_large_dataset_benchmark', category: 'background', consistency: 'replica_safe', description: 'Large dataset benchmark' },
  { rpc: 'platform_tenant_dataset_stats', category: 'background', consistency: 'replica_safe', description: 'Tenant dataset stats' },
  { rpc: 'platform_approximate_row_count', category: 'background', consistency: 'replica_safe', description: 'Approximate row counts' },
  { rpc: 'platform_database_growth_audit', category: 'background', consistency: 'replica_safe', description: 'DB growth audit' },
  { rpc: 'platform_partition_scale_benchmark', category: 'background', consistency: 'replica_safe', description: 'Partition scale benchmark' },
  { rpc: 'platform_hot_path_benchmark', category: 'background', consistency: 'replica_safe', description: 'Hot path benchmark' },
  { rpc: 'platform_payload_benchmark', category: 'background', consistency: 'replica_safe', description: 'Payload benchmark' },
];

const byRpc = new Map<string, ReadOperationSpec>(specs.map((s) => [s.rpc, s]));

/** Default for unregistered RPCs — conservative primary routing. */
const DEFAULT_SPEC: ReadOperationSpec = {
  rpc: '*',
  category: 'critical',
  consistency: 'requires_primary',
  description: 'Unregistered read — defaults to primary',
};

export function getReadOperationSpec(rpc: string): ReadOperationSpec {
  return byRpc.get(rpc) ?? { ...DEFAULT_SPEC, rpc };
}

export function requiresPrimary(rpc: string): boolean {
  return getReadOperationSpec(rpc).consistency === 'requires_primary';
}

export function isReplicaEligible(rpc: string): boolean {
  const c = getReadOperationSpec(rpc).consistency;
  return c === 'replica_safe' || c === 'eventually_consistent';
}

export function listReadOperationsByCategory(category: ReadCategory): ReadOperationSpec[] {
  return specs.filter((s) => s.category === category);
}

export function listReplicaSafeOperations(): ReadOperationSpec[] {
  return specs.filter((s) => isReplicaEligible(s.rpc));
}

export function listPrimaryOnlyOperations(): ReadOperationSpec[] {
  return specs.filter((s) => s.consistency === 'requires_primary');
}

export const READ_OPERATION_REGISTRY = specs;

export function getReadAuditSummary(): {
  total: number;
  primaryOnly: number;
  replicaSafe: number;
  eventuallyConsistent: number;
  byCategory: Record<ReadCategory, number>;
} {
  const byCategory = {} as Record<ReadCategory, number>;
  for (const s of specs) {
    byCategory[s.category] = (byCategory[s.category] ?? 0) + 1;
  }
  return {
    total: specs.length,
    primaryOnly: specs.filter((s) => s.consistency === 'requires_primary').length,
    replicaSafe: specs.filter((s) => s.consistency === 'replica_safe').length,
    eventuallyConsistent: specs.filter((s) => s.consistency === 'eventually_consistent').length,
    byCategory,
  };
}

/** PostgREST table reads — always primary until dedicated replica client exists. */
export const TABLE_READ_DEFAULT_CONSISTENCY: ReadConsistency = 'requires_primary';
