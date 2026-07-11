import { getSupabaseClient } from '@/lib/disasterRecovery/supabaseClient';
import type { RpcResult } from '@/integrations/supabase/rpc';

/** Product mutations — always via Supabase JS client (session JWT + stable transport). */
export async function supabaseRpc<T>(
  fn: string,
  args: Record<string, unknown>
): Promise<RpcResult<T>> {
  try {
    const { data, error } = await getSupabaseClient().rpc(fn as never, args as never);
    if (error) {
      return { data: null, error: error.message ?? String(error), route: 'primary' };
    }
    return { data: data as T, error: null, route: 'primary' };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'RPC failed',
      route: 'primary',
    };
  }
}
