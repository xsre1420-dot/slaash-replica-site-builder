import { supabase } from '@/integrations/supabase/client';

export type RpcResult<T> = { data: T | null; error: string | null };

/** Typed RPC wrapper — prefer service functions over calling this from UI/hooks. */
export async function callSupabaseRpc<T>(
  fn: string,
  args: Record<string, unknown>
): Promise<RpcResult<T>> {
  try {
    const { data, error } = await (supabase as any).rpc(fn, args);
    if (error) return { data: null, error: error.message ?? String(error) };
    return { data: data as T, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'RPC failed' };
  }
}
