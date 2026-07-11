import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/observability';

/** Validate session with the auth server (not storage alone). */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) {
    logger.warn('auth.session.get_user_failed', {
      domain: 'auth',
      errorCategory: 'authentication',
      status: 'error',
    }, userError);
  }
  return user?.id ?? null;
}

/** Refresh JWT if close to expiry — returns owner id when session is writable. */
export async function ensureWritableSession(): Promise<string | null> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.user?.id) return null;

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (expiresAtMs - Date.now() < 120_000) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.user?.id) return null;
    return refreshed.session.user.id;
  }

  return session.user.id;
}
