import { useState, useEffect, type FormEvent } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AuthPageShell, AuthLoadingScreen } from '@/components/auth/AuthPageShell';
import { AuthEmailField, AuthPageHeader } from '@/components/auth/AuthFormFields';
import {
  authHintClass,
  authLabelClass,
  authPasswordInputClass,
  authSubmitClass,
  authToggleButtonClass,
} from '@/components/auth/authFormStyles';
import { clearAuthUrlParams, parseAuthUrlError, validateEmail } from '@/lib/authUtils';
import { env } from '@/lib/env';

const sanitizeAuthPageUrl = () => {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/auth/callback')) return;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const isAuthCallback =
    search.has('code') ||
    hash.has('access_token') ||
    hash.has('error') ||
    search.has('error');
  if (isAuthCallback && !window.location.pathname.includes('reset-password')) {
    clearAuthUrlParams();
  }
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const { login, user, loading, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/builder';
  const { toast } = useToast();

  useEffect(() => {
    sanitizeAuthPageUrl();
    const urlError = parseAuthUrlError();
    if (urlError) {
      setError(mapAuthUrlError(urlError));
      clearAuthUrlParams();
    }
  }, []);

  useEffect(() => {
    if (!loading && user) navigate(from, { replace: true });
  }, [user, loading, navigate, from]);

  if (loading) return <AuthLoadingScreen />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    if (!password.trim()) {
      setError('يرجى إدخال كلمة المرور');
      return;
    }

    setIsLoading(true);
    setError(null);
    setEmailNotConfirmed(false);

    try {
      const result = await login(email, password, rememberMe);
      if (result.error) {
        setError(result.error);
        setEmailNotConfirmed(!!result.emailNotConfirmed);
      } else {
        toast({ title: 'تم تسجيل الدخول بنجاح', description: 'مرحباً بك مرة أخرى' });
        navigate(from, { replace: true });
      }
    } catch {
      setError('حدث خطأ غير متوقع');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    const result = await resendVerificationEmail(email);
    setResending(false);
    if (result.error) {
      toast({ title: 'خطأ', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'تم الإرسال', description: 'تحقق من بريدك الإلكتروني' });
    }
  };

  return (
    <AuthPageShell>
      <AuthPageHeader
        title="تسجيل الدخول"
        subtitle="أدخل بياناتك للوصول إلى لوحة التحكم"
        meta={
          env.VITE_SUPABASE_PUBLISHABLE_KEY === 'missing-anon-key' ? (
            <p className="text-xs text-destructive mt-2">إعدادات Supabase غير مكتملة — راجع ملف .env</p>
          ) : undefined
        }
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <Alert variant="destructive" className="rounded-lg border text-right">
            <AlertDescription className="space-y-2 text-sm">
              <p>{error}</p>
              {emailNotConfirmed && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-full rounded-lg border-destructive/30 text-sm"
                  disabled={resending}
                  onClick={handleResendVerification}
                >
                  {resending ? 'جاري الإرسال…' : 'إعادة إرسال رسالة التحقق'}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        <AuthEmailField
          id="login-email"
          label="البريد الإلكتروني"
          value={email}
          onChange={setEmail}
          disabled={isLoading}
          required
        />

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <Link
              to="/reset-password"
              className="text-xs font-medium text-primary hover:text-primary/80"
            >
              نسيت كلمة المرور؟
            </Link>
            <label htmlFor="login-password" className="text-sm font-medium text-foreground">
              كلمة المرور
            </label>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={authPasswordInputClass}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={authToggleButtonClass}
              aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <EyeOff className="h-[18px] w-[18px]" />
              ) : (
                <Eye className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>
          <p className={authHintClass}>8 أحرف على الأقل</p>
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <Label htmlFor="remember-me" className="cursor-pointer text-sm font-normal text-muted-foreground">
            تذكرني على هذا الجهاز
          </Label>
          <Checkbox
            id="remember-me"
            checked={rememberMe}
            onCheckedChange={(v) => setRememberMe(v === true)}
          />
        </div>

        <Button type="submit" className={authSubmitClass} disabled={isLoading}>
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              جارٍ تسجيل الدخول…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              تسجيل الدخول
              <ArrowLeft className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        ليس لديك حساب؟{' '}
        <Link to="/signup" className="font-semibold text-primary hover:text-primary/80">
          أنشئ حساباً مجانياً
        </Link>
      </p>
    </AuthPageShell>
  );
};

export default Login;

function mapAuthUrlError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('email not confirmed')) return 'يرجى تأكيد بريدك الإلكتروني أولاً';
  if (m.includes('invalid') && m.includes('code')) {
    return 'انتهت صلاحية رابط الدخول. حاول تسجيل الدخول يدوياً';
  }
  return message.length > 120 ? 'تعذر إكمال تسجيل الدخول. حاول مرة أخرى' : message;
}
