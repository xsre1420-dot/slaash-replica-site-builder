import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types.generated';
import { resolveSupabaseConfig } from './failover';
import { createAuthStorage } from '@/lib/authUtils';
import { env } from '@/lib/env';

let client: SupabaseClient<Database> | null = null;

export const getSupabaseClient = (): SupabaseClient<Database> => {
  if (client) return client;

  const cfg = resolveSupabaseConfig();
  const clientOptions: Parameters<typeof createClient<Database>>[2] = {
    auth: {
      storage: createAuthStorage(),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  };

  if (cfg.label === 'primary' && env.VITE_SUPABASE_POOLER_URL) {
    clientOptions.global = { headers: { 'x-connection-mode': 'pooler' } };
  }

  client = createClient<Database>(cfg.url, cfg.key, clientOptions);

  return client;
};

export const resetSupabaseClient = (): void => {
  client = null;
};
