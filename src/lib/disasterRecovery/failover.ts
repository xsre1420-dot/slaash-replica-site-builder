import { env } from '@/lib/env';
import { DR_STORAGE_KEYS } from './config';

export interface SupabaseEndpointConfig {
  url: string;
  key: string;
  label: 'primary' | 'failover';
}

export const isFailoverActive = (): boolean => {
  try {
    return sessionStorage.getItem(DR_STORAGE_KEYS.FAILOVER_ACTIVE) === '1';
  } catch {
    return false;
  }
};

export const activateFailover = (): boolean => {
  const failoverUrl = env.VITE_FAILOVER_SUPABASE_URL;
  if (!failoverUrl) return false;
  try {
    sessionStorage.setItem(DR_STORAGE_KEYS.FAILOVER_ACTIVE, '1');
    sessionStorage.setItem(DR_STORAGE_KEYS.CONSECUTIVE_FAILURES, '0');
  } catch {
    /* ignore */
  }
  return true;
};

export const deactivateFailover = (): void => {
  try {
    sessionStorage.removeItem(DR_STORAGE_KEYS.FAILOVER_ACTIVE);
    sessionStorage.setItem(DR_STORAGE_KEYS.CONSECUTIVE_FAILURES, '0');
  } catch {
    /* ignore */
  }
};

export const resolveSupabaseConfig = (): SupabaseEndpointConfig => {
  const failoverUrl = env.VITE_FAILOVER_SUPABASE_URL;
  const failoverKey = env.VITE_FAILOVER_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (isFailoverActive() && !failoverUrl) {
    deactivateFailover();
  }

  if (isFailoverActive() && failoverUrl) {
    return { url: failoverUrl, key: failoverKey, label: 'failover' };
  }

  // PostgREST + Storage live on the project URL. Pooler hostname is Postgres-only —
  // using it as REST base causes "TypeError: Failed to fetch" on mutations.
  const primaryUrl = env.VITE_SUPABASE_URL;

  return {
    url: primaryUrl,
    key: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    label: 'primary',
  };
};

export const checkEndpointHealth = async (baseUrl: string): Promise<boolean> => {
  try {
    const cfg = resolveSupabaseConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/rest/v1/`, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
      },
    });
    clearTimeout(timeout);
    return res.ok || res.status === 401 || res.status === 403 || res.status === 404;
  } catch {
    return false;
  }
};

export const getRecoveryEndpoints = (): SupabaseEndpointConfig[] => {
  const endpoints: SupabaseEndpointConfig[] = [resolveSupabaseConfig()];
  if (env.VITE_FAILOVER_SUPABASE_URL && !isFailoverActive()) {
    endpoints.push({
      url: env.VITE_FAILOVER_SUPABASE_URL,
      key: env.VITE_FAILOVER_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY,
      label: 'failover',
    });
  }
  return endpoints;
};
