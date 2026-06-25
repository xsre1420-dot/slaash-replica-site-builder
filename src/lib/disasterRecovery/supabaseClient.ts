import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types.generated';
import { resolveSupabaseConfig } from './failover';
import { createAuthStorage } from '@/lib/authUtils';
import { env } from '@/lib/env';
import { teardownMerchantRealtimeHub } from '@/lib/merchantRealtimeHub';

let client: SupabaseClient<Database> | null = null;

const sharedFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, keepalive: true });

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
    global: { fetch: sharedFetch },
    realtime: {
      params: { eventsPerSecond: 8 },
    },
    db: { schema: 'public' },
  };

  if (cfg.label === 'primary' && env.VITE_SUPABASE_POOLER_URL) {
    clientOptions.global = {
      fetch: sharedFetch,
      headers: { 'x-connection-mode': 'pooler' },
    };
  }

  client = createClient<Database>(cfg.url, cfg.key, clientOptions);

  return client;
};

export const resetSupabaseClient = (): void => {
  teardownMerchantRealtimeHub();
  client = null;
};
