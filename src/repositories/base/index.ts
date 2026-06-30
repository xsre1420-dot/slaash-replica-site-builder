/**
 * Repository base — single entry for Supabase client and RPC routing.
 * Domain services must not import @/integrations/supabase/client directly.
 */
import type { RpcResult } from '@/integrations/supabase/rpc';

export { supabase } from '@/integrations/supabase/client';
export { callSupabaseRpc, type RpcResult } from '@/integrations/supabase/rpc';
export { callReadRpc } from '@/lib/readWrite/readClient';
export { callWriteRpc } from '@/lib/readWrite/writeClient';

/** Adapt RpcResult to legacy supabase.rpc { data, error: { message } } shape. */
export function adaptRpcResult<T>(result: RpcResult<T>): {
  data: T | null;
  error: { message: string } | null;
} {
  return {
    data: result.data,
    error: result.error ? { message: result.error } : null,
  };
}

export type PostgrestResponse<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};
