/**
 * Database access layer — use repositories for Supabase I/O.
 * UI, hooks, and components must not import `@/integrations/supabase/client` directly.
 */
export { callSupabaseRpc, type RpcResult } from '@/integrations/supabase/rpc';
export * as Repositories from '@/repositories';
