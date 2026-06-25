
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo, useCallback } from 'react';
import { invalidateOwnerCache, setCurrentOwner, setCurrentStore } from '@/services/productService';
import {
  checkUsernameAvailability,
  exchangeAuthCodeForSession,
  fetchUserProfile,
  getAuthSession,
  resetPasswordForEmail,
  resendSignupVerification,
  setAuthSession,
  signInWithPassword,
  signOut as authSignOut,
  signUpWithEmail,
  subscribeAuthStateChange,
  updateAuthPassword,
} from '@/services/authService';
import { setObservabilityUser } from '@/lib/observability';
import {
  mapAuthError,
  normalizeUsername,
  validatePassword,
  setAuthRememberMe,
  logAuthFailure,
} from '@/lib/authUtils';
import { isProduction } from '@/lib/env';
import {
  enforceRateLimit,
  formatRateLimitMessageAr,
  RATE_LIMITS,
  RateLimitExceededError,
} from '@/lib/security/rateLimiter';
import { redeemAccessCode } from '@/services/leadAdminService';
import { ACCESS_CODE_ERROR_MESSAGES } from '@/types/accessCodes';
import { teardownMerchantRealtimeHub } from '@/lib/merchantRealtimeHub';

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
  loginWithAccessCode: (code: string, rememberMe?: boolean) => Promise<{ error?: string }>;
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
    const prevId = lastUserIdRef.current;
    if (u?.id && prevId && u.id !== prevId) {
      invalidateOwnerCache(prevId);
      setCurrentStore(null);
    }
    if (u?.id) lastUserIdRef.current = u.id;
    else lastUserIdRef.current = null;
    setUser(u);
    setCurrentOwner(u?.id || null);
    if (!u) setCurrentStore(null);
    setObservabilityUser(u?.id);
  };

  const loadProfile = async (userId: string, fallbackMeta?: Record<string, unknown>, email?: string) => {
    try {
      const profile = await fetchUserProfile(userId);

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
    const { data: { subscription } } = subscribeAuthStateChange((event, session) => {
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
        } else {
          const prevId = lastUserIdRef.current;
          setUserAndOwner(null);
          invalidateOwnerCache(prevId);
        }
      }, 0);
    });

    getAuthSession()
      .then(({ session }) => {
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
      enforceRateLimit(`login:${email.trim().toLowerCase()}`, RATE_LIMITS.login);
      setAuthRememberMe(rememberMe);

      const { data, error } = await signInWithPassword(email, password);

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
      if (err instanceof RateLimitExceededError) {
        return { error: formatRateLimitMessageAr(err.retryAfterMs) };
      }
      logAuthFailure('login.exception', err);
      const msg = err instanceof Error ? err.message : '';
      return { error: mapAuthError(msg) || 'حدث خطأ في الاتصال. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.' };
    }
  };

  const loginWithAccessCode = async (code: string, rememberMe = true) => {
    try {
      enforceRateLimit('access_code', RATE_LIMITS.accessCode);
      setAuthRememberMe(rememberMe);
      const result = await redeemAccessCode(code);
      const { error: sessionError } = await setAuthSession(
        result.accessToken,
        result.refreshToken
      );

      if (sessionError) {
        logAuthFailure('login.access_code.session', sessionError);
        return { error: ACCESS_CODE_ERROR_MESSAGES.login_failed };
      }

      return {};
    } catch (err) {
      if (err instanceof RateLimitExceededError) {
        return { error: formatRateLimitMessageAr(err.retryAfterMs) };
      }
      logAuthFailure('login.access_code', err);
      const code = err instanceof Error ? err.message : '';
      return { error: ACCESS_CODE_ERROR_MESSAGES[code] || 'رمز التفعيل غير صحيح أو منتهي الصلاحية' };
    }
  };

  const checkUsernameAvailable = async (username: string) => {
    try {
      const normalized = normalizeUsername(username);
      const result = await checkUsernameAvailability(normalized);
      if (result.error) return { available: false, error: result.error };
      return { available: result.available };
    } catch {
      return { available: false, error: 'تعذر التحقق من اسم المستخدم' };
    }
  };

  const register = async (
    email: string,
    password: string,
    username: string,
    storeName?: string,
    selectedPlanId?: string
  ): Promise<AuthResult> => {
    if (isProduction()) {
      return {
        error: 'التسجيل المباشر غير متاح. استخدم صفحة «طلب الوصول» للحصول على رمز تفعيل.',
      };
    }

    try {
      const passwordError = validatePassword(password);
      if (passwordError) return { error: passwordError };

      const normalizedUsername = normalizeUsername(username);
      const usernameCheck = await checkUsernameAvailable(normalizedUsername);
      if (!usernameCheck.available) {
        return { error: 'اسم المستخدم مستخدم بالفعل — اختر اسماً آخر' };
      }

      const { data, error } = await signUpWithEmail(email, password, {
        username: normalizedUsername,
        store_name: storeName?.trim() || 'متجري',
        selected_plan: selectedPlanId || 'free',
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
      const { error } = await resetPasswordForEmail(
        email,
        `${window.location.origin}/reset-password`
      );
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

      const { error } = await updateAuthPassword(newPassword);
      if (error) return { error: mapAuthError(error.message) };
      return {};
    } catch {
      return { error: 'تعذر تحديث كلمة المرور' };
    }
  };

  const resendVerificationEmail = async (email: string) => {
    try {
      const { error } = await resendSignupVerification(email);
      if (error) return { error: mapAuthError(error.message) };
      return { success: true };
    } catch {
      return { error: 'تعذر إرسال رسالة التحقق' };
    }
  };

  const logout = async () => {
    const prevId = lastUserIdRef.current;
    invalidateOwnerCache(prevId);
    teardownMerchantRealtimeHub();
    await authSignOut();
    setUserAndOwner(null);
  };

  const value = useMemo(
    () => ({
      user,
      login,
      loginWithAccessCode,
      register,
      resetPassword,
      updatePassword,
      resendVerificationEmail,
      checkUsernameAvailable,
      logout,
      loading,
    }),
    [
      user,
      loading,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
