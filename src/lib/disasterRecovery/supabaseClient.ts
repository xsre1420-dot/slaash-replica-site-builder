import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types.generated';
import { resolveSupabaseConfig } from './failover';
import { createAuthStorage } from '@/lib/authUtils';
import { env } from '@/lib/env';

let client: SupabaseClient<Database> | null = null;
let clientBaseUrl: string | null = null;

const sharedFetch: typeof fetch = (input, init) => fetch(input, init);

export const getSupabaseClient = (): SupabaseClient<Database> => {
  const cfg = resolveSupabaseConfig();
  if (client && clientBaseUrl !== cfg.url) {
    client = null;
    clientBaseUrl = null;
  }
  if (client) return client;
  const usesPooler = Boolean(env.VITE_SUPABASE_POOLER_URL?.trim()) && cfg.label === 'primary';
  const clientOptions: Parameters<typeof createClient<Database>>[2] = {
    auth: {
      storage: createAuthStorage(),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
    global: {
      fetch: sharedFetch,
      ...(usesPooler ? { headers: { 'x-connection-mode': 'pooler' } } : {}),
    },
    realtime: {
      params: { eventsPerSecond: 6 },
    },
    db: { schema: 'public' },
  };

  client = createClient<Database>(cfg.url, cfg.key, clientOptions);
  clientBaseUrl = cfg.url;

  return client;
};

export const resetSupabaseClient = (): void => {
  void import('@/lib/merchantRealtimeHub').then((m) => m.teardownMerchantRealtimeHub());
  client = null;
  clientBaseUrl = null;
};
