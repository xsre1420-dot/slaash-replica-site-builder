/**
 * Read/write routing — delegates to centralized readRouter + consistency registry.
 */
import {
  resolveReadRoute,
  resolveReadEndpoint,
  classifyRpcRoute,
  getReadRoutingSummary,
  getReplicaEligibleRpcSet,
  hasReadReplica,
  hasRegionalReplica,
  isStorefrontEdgeEnabled,
  type ReadRouteTarget,
  type ReadRouteDecision,
  type ReadRouteOptions,
  type ReadEndpoint,
} from '@/lib/readWrite/readRouter';

export {
  resolveReadRoute,
  resolveReadEndpoint,
  classifyRpcRoute,
  getReadRoutingSummary,
  getReplicaEligibleRpcSet,
  hasReadReplica,
  hasRegionalReplica,
  isStorefrontEdgeEnabled,
  type ReadRouteTarget,
  type ReadRouteDecision,
  type ReadRouteOptions,
  type ReadEndpoint,
};

/** Legacy Set export — mirrors registry replica-eligible RPCs. */
export const READ_REPLICA_RPCS = getReplicaEligibleRpcSet();

export const EDGE_CACHED_OPERATIONS = new Set([
  'get_storefront_page_bundle',
  'get_store_products_page',
  'get_store_meta',
]);

export type RpcRouteTarget = ReadRouteTarget;
export type RpcEndpoint = ReadEndpoint;

/** Resolve PostgREST base URL for an RPC call. */
export function resolveRpcEndpoint(fn: string, forcePrimary = false): RpcEndpoint {
  return resolveReadEndpoint(fn, { forcePrimary });
}
