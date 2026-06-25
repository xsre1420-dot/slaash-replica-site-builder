import { supabase } from '@/integrations/supabase/client';

/** Validate session with the auth server (not storage alone). */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.warn('[auth] getUser failed:', userError.message);
  }
  return user?.id ?? null;
}
