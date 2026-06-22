import { useState, useEffect, type FormEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { fetchMerchantAccess } from '@/services/subscriptionService';
import { useToast } from '@/hooks/use-toast';
import { AuthPageShell, AuthLoadingScreen } from '@/components/auth/AuthPageShell';
import { AuthPageHeader } from '@/components/auth/AuthFormFields';
import { authHintClass, authSubmitClass } from '@/components/auth/authFormStyles';
import { clearAuthUrlParams, parseAuthUrlError, sanitizeInternalRedirect } from '@/lib/authUtils';
import { env } from '@/lib/env';
import { formatAccessCodeInput } from '@/types/accessCodes';

const redirectAuthTokensToCallback = (navigate: (path: string, opts?: { replace?: boolean }) => void) => {
  if (typeof window === 'undefined') return false;
  if (window.location.pathname.startsWith('/auth/callback')) return false;
  const search = new URLSearchParams(window.location.search);
  const hash = window.location.hash || '';
  const hasAuthPayload =
    search.has('code') ||
    hash.includes('access_token') ||
    hash.includes('error') ||
    search.has('error');
  if (hasAuthPayload && !window.location.pathname.includes('reset-password')) {
    navigate(`/auth/callback${window.location.search}${hash}`, { replace: true });
    return true;
  }
  return false;
};

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = sanitizeInternalRedirect((location.state as { from?: string } | null)?.from);
  const { toast } = useToast();

  const [accessCode, setAccessCode] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { loginWithAccessCode, user, loading, logout } = useAuth();
  const { hasAccess, isAdmin, loading: subLoading, refresh: refreshSubscription } = useSubscription();

  useEffect(() => {
    if (redirectAuthTokensToCallback(navigate)) return;
    const urlError = parseAuthUrlError();
    if (urlError) {
      setError(mapAuthUrlError(urlError));
      clearAuthUrlParams();
    }
  }, []);

  useEffect(() => {
    if (loading || subLoading) return;
    if (!user) return;
    if (isAdmin) {
      navigate('/admin/leads', { replace: true });
      return;
    }
    if (hasAccess) {
      navigate(from, { replace: true });
    }
  }, [user, loading, subLoading, hasAccess, isAdmin, navigate, from]);

  if (loading || subLoading) return <AuthLoadingScreen />;

  const handleCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = accessCode.replace(/[^A-Za-z0-9]/g, '');
    if (normalized.length < 11) {
      setError('يرجى إدخال رمز التفعيل كاملاً');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await loginWithAccessCode(accessCode, rememberMe);
      if (result.error) {
        setError(result.error);
        return;
      }

      await refreshSubscription();
      const access = await fetchMerchantAccess();

      if (access.isAdmin) {
        navigate('/admin/leads', { replace: true });
        return;
      }

      if (access.hasAccess) {
        toast({ title: 'مرحباً بك!', description: 'تم تفعيل حسابك بنجاح' });
        navigate('/builder', { replace: true });
        return;
      }

      setError('تم قبول الرمز لكن الاشتراك غير نشط — تواصل مع فريق المبيعات');
      await logout();
    } catch {
      setError('حدث خطأ غير متوقع');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthPageShell>
      <AuthPageHeader
        title="تسجيل الدخول"
        subtitle="أدخل رمز التفعيل الذي أرسله لك فريق المبيعات"
        meta={
          env.VITE_SUPABASE_PUBLISHABLE_KEY === 'missing-anon-key' ? (
            <p className="text-xs text-destructive mt-2">إعدادات Supabase غير مكتملة — راجع ملف .env</p>
          ) : undefined
        }
      />

      <form onSubmit={handleCodeSubmit} className="space-y-5">
        {error && (
          <Alert variant="destructive" className="rounded-lg border text-right">
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        <div>
          <Label htmlFor="access-code" className="mb-1.5 block text-sm font-medium">
            رمز التفعيل
          </Label>
          <Input
            id="access-code"
            value={accessCode}
            onChange={(e) => setAccessCode(formatAccessCodeInput(e.target.value))}
            placeholder="BDY-XXXX-XXXX"
            className="h-12 rounded-xl text-center font-mono text-lg tracking-widest"
            dir="ltr"
            autoComplete="off"
            disabled={isLoading}
            required
          />
          <p className={authHintClass}>الرمز صالح لمدة اشتراكك (6 أشهر أو سنة)</p>
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <Label htmlFor="remember-me-code" className="cursor-pointer text-sm font-normal text-muted-foreground">
            تذكرني على هذا الجهاز
          </Label>
          <Checkbox
            id="remember-me-code"
            checked={rememberMe}
            onCheckedChange={(v) => setRememberMe(v === true)}
          />
        </div>

        <Button type="submit" className={authSubmitClass} disabled={isLoading}>
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              جارٍ التحقق…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              دخول للمنصة
              <ArrowLeft className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        ليس لديك رمز؟{' '}
        <Link to="/request-access" className="font-semibold text-primary hover:text-primary/80">
          اطلب اشتراكاً
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
