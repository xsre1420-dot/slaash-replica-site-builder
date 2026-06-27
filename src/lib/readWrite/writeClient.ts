/**
 * Write-path RPC — always uses primary DB for strong consistency.
 */
import { callSupabaseRpc, type RpcCallOptions, type RpcResult } from '@/integrations/supabase/rpc';

export type WriteRpcOptions = RpcCallOptions;

export async function callWriteRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  options: WriteRpcOptions = {}
): Promise<RpcResult<T>> {
  return callSupabaseRpc<T>(fn, args, { ...options, forcePrimary: true });
}
