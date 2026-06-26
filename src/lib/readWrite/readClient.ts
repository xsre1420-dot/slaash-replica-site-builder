/**
 * Read-path RPC — routes to read replica when classified safe (eventual consistency OK).
 * Never performs cache invalidation or writes.
 */
import { callSupabaseRpc, type RpcCallOptions, type RpcResult } from '@/integrations/supabase/rpc';
import { classifyRpcRoute } from '@/lib/disasterRecovery/readRouting';

export type ReadRpcOptions = Omit<RpcCallOptions, 'forcePrimary'>;

export async function callReadRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  options: ReadRpcOptions = {}
): Promise<RpcResult<T>> {
  const route = classifyRpcRoute(fn);
  return callSupabaseRpc<T>(fn, args, {
    ...options,
    forcePrimary: route === 'primary',
  });
}

export { classifyRpcRoute };
