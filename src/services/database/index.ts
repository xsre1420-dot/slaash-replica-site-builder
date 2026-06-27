/**
 * Database access layer — all Supabase RPC/table calls should live in domain services.
 * UI, hooks, and components must not import `@/integrations/supabase/client` directly.
 */
export { callSupabaseRpc, type RpcResult } from '@/integrations/supabase/rpc';
