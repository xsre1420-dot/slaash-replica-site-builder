/**
 * Repository base — single entry for Supabase client and RPC routing.
 * Domain services must not import @/integrations/supabase/client directly.
 */
export { supabase } from '@/integrations/supabase/client';
export { callSupabaseRpc, type RpcResult } from '@/integrations/supabase/rpc';
export { callReadRpc } from '@/lib/readWrite/readClient';
export { callWriteRpc } from '@/lib/readWrite/writeClient';

export type PostgrestResponse<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};
