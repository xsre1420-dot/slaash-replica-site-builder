/**
 * Centralized read routing — all classified reads resolve through this layer.
 * Targets: primary | read_replica | regional_replica | edge_cache | client_cache
 */
import { env } from '@/lib/env';
import { resolveSupabaseConfig } from '@/lib/disasterRecovery/failover';
import {
  getReadOperationSpec,
  isReplicaEligible,
  requiresPrimary,
  listReplicaSafeOperations,
  listPrimaryOnlyOperations,
  getReadAuditSummary,
  type ReadConsistency,
} from '@/lib/readWrite/readConsistencyRegistry';

export type ReadRouteTarget =
  | 'primary'
  | 'read_replica'
  | 'regional_replica'
  | 'edge_cache'
  | 'client_cache';

export type ReadRouteDecision = {
  target: ReadRouteTarget;
  consistency: ReadConsistency;
  rpc: string;
  reason: string;
};

export type ReadRouteOptions = {
  forcePrimary?: boolean;
  preferClientCache?: boolean;
  preferEdge?: boolean;
  /** Override registry consistency (use sparingly). */
  consistencyOverride?: ReadConsistency;
};

const EDGE_STOREFRONT_RPCS = new Set([
  'get_storefront_page_bundle',
  'get_store_products_page',
  'get_store_meta',
]);

export function isStorefrontEdgeEnabled(): boolean {
  const flag = env.VITE_STOREFRONT_EDGE_ENABLED;
  return flag === 'true' || flag === '1';
}

export function hasReadReplica(): boolean {
  return Boolean(env.VITE_SUPABASE_READ_REPLICA_URL?.trim());
}

export function hasRegionalReplica(): boolean {
  return Boolean(env.VITE_SUPABASE_REGIONAL_REPLICA_URL?.trim());
}

export function getRegionalReplicaRegion(): string | null {
  const region = env.VITE_READ_REPLICA_REGION?.trim();
  return region || null;
}

/** Classify where an RPC read should be routed. */
export function resolveReadRoute(rpc: string, options: ReadRouteOptions = {}): ReadRouteDecision {
  const spec = getReadOperationSpec(rpc);
  const consistency = options.consistencyOverride ?? spec.consistency;

  if (options.forcePrimary || consistency === 'requires_primary' || requiresPrimary(rpc)) {
    return { target: 'primary', consistency, rpc, reason: 'requires_primary' };
  }

  if (options.preferClientCache && spec.clientCacheEligible) {
    return { target: 'client_cache', consistency, rpc, reason: 'client_cache_eligible' };
  }

  if (
    (options.preferEdge || spec.edgeEligible) &&
    EDGE_STOREFRONT_RPCS.has(rpc) &&
    isStorefrontEdgeEnabled()
  ) {
    return { target: 'edge_cache', consistency, rpc, reason: 'storefront_edge' };
  }

  if (hasRegionalReplica() && isReplicaEligible(rpc)) {
    return { target: 'regional_replica', consistency, rpc, reason: 'regional_replica_configured' };
  }

  if (hasReadReplica() && isReplicaEligible(rpc)) {
    return { target: 'read_replica', consistency, rpc, reason: 'read_replica_configured' };
  }

  return { target: 'primary', consistency, rpc, reason: 'replica_not_configured' };
}

export type ReadEndpoint = {
  url: string;
  key: string;
  label: 'primary' | 'read_replica' | 'regional_replica' | 'failover';
  headers?: Record<string, string>;
};

/** Resolve PostgREST URL for a read RPC. */
export function resolveReadEndpoint(rpc: string, options: ReadRouteOptions = {}): ReadEndpoint {
  const cfg = resolveSupabaseConfig();
  const decision = resolveReadRoute(rpc, options);

  if (decision.target === 'regional_replica') {
    const url = env.VITE_SUPABASE_REGIONAL_REPLICA_URL!.replace(/\/$/, '');
    const region = getRegionalReplicaRegion();
    return {
      url,
      key: cfg.key,
      label: 'regional_replica',
      headers: {
        Prefer: 'count=none',
        'x-read-replica': '1',
        ...(region ? { 'x-read-region': region } : {}),
      },
    };
  }

  if (decision.target === 'read_replica') {
    const url = env.VITE_SUPABASE_READ_REPLICA_URL!.replace(/\/$/, '');
    return {
      url,
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

/** @deprecated Use resolveReadRoute — kept for existing imports. */
export function classifyRpcRoute(rpc: string): ReadRouteTarget {
  return resolveReadRoute(rpc).target;
}

/** Backward-compatible replica RPC set derived from registry. */
export function getReplicaEligibleRpcSet(): Set<string> {
  return new Set(listReplicaSafeOperations().map((s) => s.rpc));
}

export function getReadRoutingSummary(): {
  readReplicaConfigured: boolean;
  regionalReplicaConfigured: boolean;
  edgeEnabled: boolean;
  replicaEligibleRpcCount: number;
  primaryOnlyRpcCount: number;
  regionalRegion: string | null;
} {
  const audit = getReadAuditSummary();
  return {
    readReplicaConfigured: hasReadReplica(),
    regionalReplicaConfigured: hasRegionalReplica(),
    edgeEnabled: isStorefrontEdgeEnabled(),
    replicaEligibleRpcCount: audit.replicaSafe + audit.eventuallyConsistent,
    primaryOnlyRpcCount: listPrimaryOnlyOperations().length,
    regionalRegion: getRegionalReplicaRegion(),
  };
}
