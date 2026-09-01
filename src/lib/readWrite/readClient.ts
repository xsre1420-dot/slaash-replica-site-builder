/**
 * Read-path RPC — routes through centralized readRouter (replica / regional / edge / primary).
 * Never performs cache invalidation or writes.
 */
import { callSupabaseRpc, type RpcCallOptions, type RpcResult } from '@/integrations/supabase/rpc';
import { resolveReadRoute, type ReadRouteOptions } from '@/lib/readWrite/readRouter';
import type { ReadConsistency } from '@/lib/readWrite/readConsistencyRegistry';

export type ReadRpcOptions = Omit<RpcCallOptions, 'forcePrimary'> & {
  /** Force primary even for replica-eligible reads. */
  forcePrimary?: boolean;
  /** Override registry consistency classification. */
  consistencyOverride?: ReadConsistency;
  preferClientCache?: boolean;
  preferEdge?: boolean;
  /** Skip read-replica → primary retry (storefront hot path). */
  skipReplicaFallback?: boolean;
};

export async function callReadRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  options: ReadRpcOptions = {}
): Promise<RpcResult<T>> {
  const decision = resolveReadRoute(fn, {
    forcePrimary: options.forcePrimary,
    consistencyOverride: options.consistencyOverride,
    preferClientCache: options.preferClientCache,
    preferEdge: options.preferEdge,
  });

  return callSupabaseRpc<T>(fn, args, {
    ...options,
    forcePrimary: decision.target === 'primary' || decision.target === 'client_cache',
    readRoute: decision,
  });
}

export { resolveReadRoute } from '@/lib/readWrite/readRouter';
export {
  getReadOperationSpec,
  requiresPrimary,
  isReplicaEligible,
  listReplicaSafeOperations,
  listPrimaryOnlyOperations,
  getReadAuditSummary,
  type ReadConsistency,
  type ReadCategory,
} from '@/lib/readWrite/readConsistencyRegistry';
