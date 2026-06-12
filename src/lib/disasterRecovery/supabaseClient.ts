import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { resolveSupabaseConfig } from './failover';

let client: SupabaseClient<Database> | null = null;

export const getSupabaseClient = (): SupabaseClient<Database> => {
  if (client) return client;

  const cfg = resolveSupabaseConfig();
  client = createClient<Database>(cfg.url, cfg.key, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return client;
};

export const resetSupabaseClient = (): void => {
  client = null;
};
