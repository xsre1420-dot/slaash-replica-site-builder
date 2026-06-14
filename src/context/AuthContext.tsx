
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invalidateOwnerCache, setCurrentOwner, setCurrentStore } from '@/services/productService';
import { setObservabilityUser } from '@/lib/observability';
import {
  mapAuthError,
  normalizeUsername,
  validatePassword,
  setAuthRememberMe,
  getAuthCallbackUrl,
  logAuthFailure,
} from '@/lib/authUtils';

interface User {
  id: string;
  username: string;
  store_name?: string;
  email?: string;
}

interface AuthResult {
  error?: string;
  needsEmailVerification?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ error?: string; emailNotConfirmed?: boolean }>;
  register: (
    email: string,
    password: string,
    username: string,
    storeName?: string,
    selectedPlanId?: string
  ) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<{ error?: string; success?: boolean }>;
  updatePassword: (newPassword: string) => Promise<{ error?: string }>;
  resendVerificationEmail: (email: string) => Promise<{ error?: string; success?: boolean }>;
  checkUsernameAvailable: (username: string) => Promise<{ available: boolean; error?: string }>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUserIdRef = useRef<string | null>(null);

  const setUserAndOwner = (u: User | null) => {
    if (u?.id) lastUserIdRef.current = u.id;
    setUser(u);
    setCurrentOwner(u?.id || null);
    if (!u) setCurrentStore(null);
    setObservabilityUser(u?.id);
  };

  const loadProfile = async (userId: string, fallbackMeta?: Record<string, unknown>, email?: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, username, store_name')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Profile fetch failed:', error.message);
        logAuthFailure('profile.load', error);
      }

      if (profile) {
        setUserAndOwner({
          id: userId,
          username: profile.username || (fallbackMeta?.username as string) || 'مستخدم',
          store_name: profile.store_name || (fallbackMeta?.store_name as string),
          email,
        });
      } else if (fallbackMeta) {
        setUserAndOwner({
          id: userId,
          username: (fallbackMeta.username as string) || 'مستخدم',
          store_name: fallbackMeta.store_name as string | undefined,
          email,
        });
      }
    } catch (e) {
      console.warn('Profile fetch failed:', e);
      if (fallbackMeta) {
        setUserAndOwner({
          id: userId,
          username: (fallbackMeta.username as string) || 'مستخدم',
          store_name: fallbackMeta.store_name as string | undefined,
          email,
        });
      }
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Defer Supabase calls/state updates to avoid auth deadlocks (Supabase recommendation)
      setTimeout(() => {
        if (session?.user) {
          const meta = session.user.user_metadata ?? {};
          setUserAndOwner({
            id: session.user.id,
            username: (meta.username as string) || session.user.email?.split('@')[0] || 'مستخدم',
            store_name: meta.store_name as string | undefined,
            email: session.user.email,
          });
          void loadProfile(session.user.id, meta, session.user.email);
        } else if (event === 'SIGNED_OUT') {
          const prevId = lastUserIdRef.current;
          setUserAndOwner(null);
          invalidateOwnerCache(prevId);
        }
      }, 0);
    });

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          const meta = session.user.user_metadata ?? {};
          setUserAndOwner({
            id: session.user.id,
            username: (meta.username as string) || session.user.email?.split('@')[0] || 'مستخدم',
            store_name: meta.store_name as string | undefined,
            email: session.user.email,
          });
          setTimeout(() => loadProfile(session.user.id, meta, session.user.email), 0);
        } else {
          setUserAndOwner(null);
        }
      })
      .catch((error) => {
        console.error('Error initializing auth:', error);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string, rememberMe = true) => {
    try {
      setAuthRememberMe(rememberMe);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        logAuthFailure('login', error);
        const mapped = mapAuthError(error.message);
        if (mapped === '__EMAIL_NOT_CONFIRMED__') {
          return { error: 'يرجى تأكيد بريدك الإلكتروني أولاً', emailNotConfirmed: true };
        }
        return { error: mapped };
      }

      if (!data.session) {
        return { error: 'تعذر إنشاء الجلسة. حاول مرة أخرى' };
      }

      return {};
    } catch (err) {
      logAuthFailure('login.exception', err);
      const msg = err instanceof Error ? err.message : '';
      return { error: mapAuthError(msg) || 'حدث خطأ في الاتصال. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.' };
    }
  };

  const checkUsernameAvailable = async (username: string) => {
    try {
      const normalized = normalizeUsername(username);
      const { data, error } = await (supabase as unknown as { rpc: (n: string, p: object) => Promise<{ data: boolean | null; error: { message: string } | null }> }).rpc(
        'is_username_available',
        { p_username: normalized }
      );
      if (error) return { available: true };
      return { available: data !== false };
    } catch {
      return { available: true };
    }
  };

  const register = async (
    email: string,
    password: string,
    username: string,
    storeName?: string,
    selectedPlanId?: string
  ): Promise<AuthResult> => {
    try {
      const passwordError = validatePassword(password);
      if (passwordError) return { error: passwordError };

      const normalizedUsername = normalizeUsername(username);
      const usernameCheck = await checkUsernameAvailable(normalizedUsername);
      if (!usernameCheck.available) {
        return { error: 'اسم المستخدم مستخدم بالفعل — اختر اسماً آخر' };
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: getAuthCallbackUrl(),
          data: {
            username: normalizedUsername,
            store_name: storeName?.trim() || 'متجري',
            selected_plan: selectedPlanId || 'free',
          },
        },
      });

      if (error) {
        logAuthFailure('register', error);
        return { error: mapAuthError(error.message) };
      }

      return { needsEmailVerification: !data.session };
    } catch (err) {
      logAuthFailure('register.exception', err);
      const msg = err instanceof Error ? err.message : '';
      return { error: mapAuthError(msg) || 'حدث خطأ أثناء إنشاء الحساب' };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) return { error: mapAuthError(error.message) };
      return { success: true };
    } catch {
      return { error: 'تعذر إرسال رابط إعادة التعيين' };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const passwordError = validatePassword(newPassword);
      if (passwordError) return { error: passwordError };

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { error: mapAuthError(error.message) };
      return {};
    } catch {
      return { error: 'تعذر تحديث كلمة المرور' };
    }
  };

  const resendVerificationEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: getAuthCallbackUrl(),
        },
      });
      if (error) return { error: mapAuthError(error.message) };
      return { success: true };
    } catch {
      return { error: 'تعذر إرسال رسالة التحقق' };
    }
  };

  const logout = async () => {
    const prevId = lastUserIdRef.current;
    invalidateOwnerCache(prevId);
    await supabase.auth.signOut();
    setUserAndOwner(null);
  };

  const value = {
    user,
    login,
    register,
    resetPassword,
    updatePassword,
    resendVerificationEmail,
    checkUsernameAvailable,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
