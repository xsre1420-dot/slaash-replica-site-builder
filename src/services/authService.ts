/**
 * Authentication & session — single source of truth for Supabase Auth + profile reads.
 */
import { supabase } from '@/integrations/supabase/client';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getAuthCallbackUrl } from '@/lib/authUtils';
import { callSupabaseRpc } from '@/services/database';

export interface UserProfile {
  id: string;
  username: string;
  store_name?: string;
}

export async function getAuthSession(): Promise<{ session: Session | null; error: string | null }> {
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error: error?.message ?? null };
}

export function subscribeAuthStateChange(
  handler: (event: AuthChangeEvent, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(handler);
}

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email: email.trim(), password });
}

export async function setAuthSession(accessToken: string, refreshToken: string) {
  return supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
}

export async function signUpWithEmail(
  email: string,
  password: string,
  metadata: Record<string, unknown>
) {
  return supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: getAuthCallbackUrl(),
      data: metadata,
    },
  });
}

export async function resetPasswordForEmail(email: string, redirectTo: string) {
  return supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
}

export async function updateAuthPassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword });
}

export async function resendSignupVerification(email: string) {
  return supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: getAuthCallbackUrl() },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function exchangeAuthCodeForSession(code: string) {
  return supabase.auth.exchangeCodeForSession(code);
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, store_name')
    .or(`id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle();

  if (error || !profile) return null;

  return {
    id: userId,
    username: profile.username || 'مستخدم',
    store_name: profile.store_name ?? undefined,
  };
}

export async function checkUsernameAvailability(
  username: string
): Promise<{ available: boolean; error?: string }> {
  const { data, error } = await callSupabaseRpc<boolean>('is_username_available', {
    p_username: username,
  });
  if (error) return { available: false, error: 'تعذر التحقق من اسم المستخدم' };
  return { available: data !== false };
}

/** @deprecated Use checkUsernameAvailability */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const result = await checkUsernameAvailability(username);
  return result.available;
}
