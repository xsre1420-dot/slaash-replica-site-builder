/**
 * Read/write routing — classify RPCs for primary vs read-replica vs edge cache.
 * Stateless: routing config only; endpoint URLs from env.
 */
import { env } from '@/lib/env';
import { resolveSupabaseConfig } from './failover';

export type RpcRouteTarget = 'primary' | 'read_replica' | 'edge_cache' | 'client_cache';

/** STABLE / read-only RPCs safe on read replica (eventual consistency OK). */
export const READ_REPLICA_RPCS = new Set([
  'get_store_products_page',
  'get_storefront_page_bundle',
  'get_store_meta',
  'get_store_products_by_slug',
  'get_store_product_by_id',
  'get_owner_products_page',
  'get_merchant_product_by_id',
  'list_merchant_orders',
  'count_merchant_orders_by_workflow',
  'get_dashboard_statistics_batch',
  'get_store_statistics',
  'get_order_items_for_statistics',
  'get_owner_bootstrap',
  'list_public_store_slugs',
  'get_background_jobs_status',
  'platform_health_check',
  'platform_lifecycle_audit',
  'platform_internals_audit',
  'platform_database_resource_audit',
  'platform_distributed_scaling_audit',
]);

/** Storefront paths served via edge function + CDN when enabled. */
export const EDGE_CACHED_OPERATIONS = new Set([
  'get_storefront_page_bundle',
  'get_store_products_page',
  'get_store_meta',
]);

export function classifyRpcRoute(fn: string): RpcRouteTarget {
  if (EDGE_CACHED_OPERATIONS.has(fn) && isStorefrontEdgeEnabled()) {
    return 'edge_cache';
  }
  if (READ_REPLICA_RPCS.has(fn) && hasReadReplica()) {
    return 'read_replica';
  }
  return 'primary';
}

export function hasReadReplica(): boolean {
  return Boolean(env.VITE_SUPABASE_READ_REPLICA_URL?.trim());
}

export function isStorefrontEdgeEnabled(): boolean {
  const flag = env.VITE_STOREFRONT_EDGE_ENABLED;
  return flag === 'true' || flag === '1';
}

export type RpcEndpoint = {
  url: string;
  key: string;
  label: 'primary' | 'read_replica' | 'failover';
  headers?: Record<string, string>;
};

/** Resolve PostgREST base URL for an RPC call. */
export function resolveRpcEndpoint(fn: string, forcePrimary = false): RpcEndpoint {
  const cfg = resolveSupabaseConfig();
  const route = forcePrimary ? 'primary' : classifyRpcRoute(fn);

  if (route === 'read_replica') {
    const replicaUrl = env.VITE_SUPABASE_READ_REPLICA_URL!.replace(/\/$/, '');
    return {
      url: replicaUrl,
      key: cfg.key,
      label: 'read_replica',
      headers: { Prefer: 'count=none', 'x-read-replica': '1' },
    };
  }

  return {
    url: cfg.url.replace(/\/$/, ''),
    key: cfg.key,
    label: cfg.label === 'failover' ? 'failover' : 'primary',
  };
}

export function getReadRoutingSummary(): {
  readReplicaConfigured: boolean;
  edgeEnabled: boolean;
  readReplicaRpcCount: number;
  edgeCachedRpcCount: number;
} {
  return {
    readReplicaConfigured: hasReadReplica(),
    edgeEnabled: isStorefrontEdgeEnabled(),
    readReplicaRpcCount: READ_REPLICA_RPCS.size,
    edgeCachedRpcCount: EDGE_CACHED_OPERATIONS.size,
  };
}
