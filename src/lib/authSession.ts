import { supabase } from '@/integrations/supabase/client';

/** Prefer cached session; fall back to getUser() for upload/API guards */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.warn('[auth] getSession failed:', sessionError.message);
  }
  if (session?.user?.id) return session.user.id;

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.warn('[auth] getUser failed:', userError.message);
  }
  return user?.id ?? null;
}
