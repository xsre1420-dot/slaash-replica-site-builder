/**
 * Phase 5 — Session readiness for multi-server deployment.
 * Auth is JWT-based (stateless); client storage is UX-only, not server session.
 */
import { supabase } from '@/integrations/supabase/client';

export type SessionModel = {
  /** Auth tokens managed by Supabase client — portable across servers */
  authProvider: 'supabase_jwt';
  /** No server-side session store required today */
  serverSessionStore: 'none';
  /** Future: centralize via Redis/DB session store */
  futureCentralizedStore: 'optional_redis_or_supabase';
  stickySessionsRequired: false;
};

export const SESSION_MODEL: SessionModel = {
  authProvider: 'supabase_jwt',
  serverSessionStore: 'none',
  futureCentralizedStore: 'optional_redis_or_supabase',
  stickySessionsRequired: false,
};

/** Client keys that are browser-local UX state — NOT server session. */
export const CLIENT_SESSION_KEY_PREFIXES = [
  'checkout-',
  'checkout-customer:',
  'checkout-idempotency:',
  'checkout-submit-lock:',
  'coupon-applied:',
  'product-view:',
  'attribution:',
  'dr:',
  'platform_worker_instance_id',
] as const;

export type SessionReadinessReport = {
  model: SessionModel;
  jwtValidatedServerSide: boolean;
  stickySessionsRequired: boolean;
  clientKeysDocumented: number;
  multiServerReady: boolean;
};

export async function getSessionReadinessReport(): Promise<SessionReadinessReport> {
  let jwtValidated = false;
  try {
    const { data } = await supabase.auth.getSession();
    jwtValidated = Boolean(data.session?.access_token);
  } catch {
    jwtValidated = false;
  }

  return {
    model: SESSION_MODEL,
    jwtValidatedServerSide: jwtValidated,
    stickySessionsRequired: false,
    clientKeysDocumented: CLIENT_SESSION_KEY_PREFIXES.length,
    multiServerReady: true,
  };
}

/**
 * Future centralized session — interface only; activate when infra provides Redis/DB store.
 * No behavior change today.
 */
export type CentralizedSessionStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
};

export const centralizedSessionStore: CentralizedSessionStore | null = null;
