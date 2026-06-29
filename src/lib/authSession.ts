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
