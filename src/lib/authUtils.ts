export const PASSWORD_MIN_LENGTH = 8;
export const USERNAME_PATTERN = /^[a-z0-9_-]{3,30}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const AUTH_REMEMBER_KEY = 'slaash_auth_remember';
export const AUTH_CALLBACK_PATH = '/auth/callback';

export const getAuthCallbackUrl = (): string => {
  if (typeof window === 'undefined') return AUTH_CALLBACK_PATH;
  return `${window.location.origin}${AUTH_CALLBACK_PATH}`;
};

/** Only allow same-origin relative paths (blocks open redirects). */
export const sanitizeInternalRedirect = (path: string | undefined | null, fallback = '/builder'): string => {
  if (!path || typeof path !== 'string') return fallback;
  const trimmed = path.trim();
  if (!/^\/(?!\/)[\w\-./?=&%]*$/.test(trimmed)) return fallback;
  return trimmed;
};

/** Structured auth error logging + health monitoring */
export const logAuthFailure = (operation: string, detail: unknown): void => {
  const payload =
    detail instanceof Error
      ? { message: detail.message, name: detail.name }
      : detail;
  console.error(`[auth.${operation}]`, payload);

  void import('@/lib/observability/healthMonitor').then(({ recordHealthEvent }) => {
    const domain = operation.startsWith('register') ? 'auth.register' : 'auth.login';
    const message =
      detail instanceof Error
        ? detail.message
        : typeof detail === 'object' && detail && 'message' in detail
          ? String((detail as { message: unknown }).message)
          : String(detail);
    recordHealthEvent(domain, false, { message: `${operation}: ${message}` });
  });
};

export const normalizeUsername = (username: string): string =>
  username.trim().toLowerCase();

export const validateEmail = (email: string): string | null => {
  if (!email.trim()) return 'البريد الإلكتروني مطلوب';
  if (!EMAIL_PATTERN.test(email.trim())) return 'يرجى إدخال بريد إلكتروني صحيح';
  return null;
};

export const validateUsername = (username: string): string | null => {
  const normalized = normalizeUsername(username);
  if (!normalized) return 'اسم المستخدم مطلوب';
  if (!USERNAME_PATTERN.test(normalized)) {
    return 'اسم المستخدم: 3-30 حرف، أحرف إنجليزية صغيرة وأرقام و _ - فقط';
  }
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `كلمة المرور يجب أن تكون ${PASSWORD_MIN_LENGTH} أحرف على الأقل`;
  }
  return null;
};

export const getPasswordStrength = (password: string): number => {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4);
};

/** Map Supabase errors to safe, user-friendly Arabic messages */
export const mapAuthError = (message: string): string => {
  const m = message.toLowerCase();

  if (m.includes('invalid login credentials') || m.includes('invalid email or password')) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
  }
  if (m.includes('email not confirmed')) {
    return '__EMAIL_NOT_CONFIRMED__';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'تعذر إنشاء الحساب. إذا كان لديك حساب، سجّل الدخول أو استخدم استعادة كلمة المرور';
  }
  if (m.includes('password') && (m.includes('least') || m.includes('weak') || m.includes('short'))) {
    return `كلمة المرور يجب أن تكون ${PASSWORD_MIN_LENGTH} أحرف على الأقل`;
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'محاولات كثيرة. يرجى الانتظار دقيقة ثم المحاولة مجدداً';
  }
  if (m.includes('signup is disabled')) {
    return 'التسجيل غير متاح حالياً. يرجى التواصل مع الدعم';
  }
  if (m.includes('email') && m.includes('invalid')) {
    return 'يرجى إدخال بريد إلكتروني صحيح';
  }
  if (m.includes('token') && (m.includes('expired') || m.includes('invalid'))) {
    return 'انتهت صلاحية الرابط. اطلب رابطاً جديداً';
  }
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('fetch')) {
    return 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً';
  }
  if (m.includes('invalid api key') || m.includes('api key')) {
    return 'خطأ في إعدادات النظام. يرجى التواصل مع الدعم';
  }
  if (m.includes('database error saving new user') || m.includes('database error')) {
    return 'تعذر إنشاء الحساب بسبب خطأ في قاعدة البيانات. حاول مرة أخرى أو تواصل مع الدعم';
  }
  if (m.includes('duplicate key') || m.includes('unique constraint')) {
    return 'البيانات المدخلة مستخدمة بالفعل — جرّب بريداً أو اسم مستخدم مختلفاً';
  }

  if (import.meta.env.DEV && message.trim()) {
    return message.length > 160 ? `${message.slice(0, 160)}…` : message;
  }

  return 'حدث خطأ. يرجى المحاولة مرة أخرى';
};

/** Parse Supabase auth errors from URL hash/query after failed redirects */
export const parseAuthUrlError = (): string | null => {
  if (typeof window === 'undefined') return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const search = new URLSearchParams(window.location.search);
  const raw =
    hash.get('error_description') ||
    search.get('error_description') ||
    hash.get('error') ||
    search.get('error');
  if (!raw) return null;
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw;
  }
};

export const clearAuthUrlParams = (): void => {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  window.history.replaceState({}, '', path);
};

export const isRecoveryUrl = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const search = new URLSearchParams(window.location.search);
  return (
    hash.get('type') === 'recovery' ||
    search.get('type') === 'recovery' ||
    search.has('code')
  );
};

export const setAuthRememberMe = (remember: boolean): void => {
  localStorage.setItem(AUTH_REMEMBER_KEY, remember ? 'persistent' : 'session');
  if (!remember) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('sb-')) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }
};

export const createAuthStorage = () => ({
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key) ?? sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      const persistent = localStorage.getItem(AUTH_REMEMBER_KEY) !== 'session';
      (persistent ? localStorage : sessionStorage).setItem(key, value);
      // Keep a single active session — remove from the other storage
      (persistent ? sessionStorage : localStorage).removeItem(key);
    } catch {
      /* ignore quota errors */
    }
  },
  removeItem(key: string): void {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
});
