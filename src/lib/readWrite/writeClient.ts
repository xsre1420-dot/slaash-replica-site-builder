/**
 * Write-path RPC — uses Supabase JS client (reliable auth/session) with fetch fallback.
 */
import { callSupabaseRpc, callSupabaseRpcLegacy, type RpcCallOptions, type RpcResult } from '@/integrations/supabase/rpc';
import { isRpcTransportError } from '@/lib/productUpdateUtils';

export type WriteRpcOptions = RpcCallOptions;

export async function callWriteRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  options: WriteRpcOptions = {}
): Promise<RpcResult<T>> {
  const viaClient = await callSupabaseRpcLegacy<T>(fn, args);
  if (!viaClient.error) return viaClient;

  if (!isRpcTransportError(viaClient.error)) return viaClient;

  return callSupabaseRpc<T>(fn, args, { ...options, forcePrimary: true });
}
