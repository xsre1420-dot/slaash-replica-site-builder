import { callWriteRpc } from '@/lib/readWrite/writeClient';
import type { RpcResult } from '@/integrations/supabase/rpc';

/**
 * @deprecated Prefer callWriteRpc from @/repositories/base — retained for legacy imports.
 * Delegates to centralized write router (retry, circuit breaker, correlation).
 */
export async function supabaseRpc<T>(
  fn: string,
  args: Record<string, unknown>
): Promise<RpcResult<T>> {
  return callWriteRpc<T>(fn, args);
}
