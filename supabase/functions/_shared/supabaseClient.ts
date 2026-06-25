/**
 * Singleton Supabase clients for Edge Functions — reuse HTTP connections across invocations.
 */
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

let serviceClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

const sharedFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, keepalive: true });

const baseClientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: { fetch: sharedFetch },
};

export function getServiceSupabase(): SupabaseClient {
  if (serviceClient) return serviceClient;

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
  }

  serviceClient = createClient(url, key, baseClientOptions);
  return serviceClient;
}

export function getAnonSupabase(): SupabaseClient {
  if (anonClient) return anonClient;

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY missing');
  }

  anonClient = createClient(url, key, baseClientOptions);
  return anonClient;
}

/** User-scoped client — lightweight wrapper; reuses anon singleton transport. */
export function getUserSupabase(authHeader: string): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  return createClient(url, key, {
    ...baseClientOptions,
    global: {
      fetch: sharedFetch,
      headers: { Authorization: authHeader },
    },
  });
}

export function edgeSupabaseStats(): { service: boolean; anon: boolean } {
  return { service: serviceClient != null, anon: anonClient != null };
}
