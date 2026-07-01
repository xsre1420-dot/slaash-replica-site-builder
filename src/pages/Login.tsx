import { useState, useEffect, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { fetchMerchantAccess } from '@/services/subscriptionService';
import { previewAccessCode } from '@/services/leadAdminService';
import { useToast } from '@/hooks/use-toast';
import { AuthPageShell, AuthLoadingScreen } from '@/components/auth/AuthPageShell';
import { AuthPageHeader } from '@/components/auth/AuthFormFields';
import { authHintClass, authSubmitClass } from '@/components/auth/authFormStyles';
import { clearAuthUrlParams, parseAuthUrlError, sanitizeInternalRedirect } from '@/lib/authUtils';
import { env } from '@/lib/env';
import { ACCESS_CODE_ERROR_MESSAGES, formatAccessCodeInput, type AccessCodePreview } from '@/types/accessCodes';
import { PUBLIC_SUBSCRIPTION_PLANS } from '@/data/subscriptionPlans';

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

const planLabel = (planId: string) =>
  PUBLIC_SUBSCRIPTION_PLANS.find((p) => p.id === planId)?.name ??
  (planId === 'yearly' ? 'باقة سنوية' : 'باقة 6 أشهر');

type LoginStep = 'enter' | 'confirm';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = sanitizeInternalRedirect((location.state as { from?: string } | null)?.from);
  const { toast } = useToast();

  const [step, setStep] = useState<LoginStep>('enter');
  const [accessCode, setAccessCode] = useState('');
  const [preview, setPreview] = useState<AccessCodePreview | null>(null);
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

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = accessCode.replace(/[^A-Za-z0-9]/g, '');
    if (normalized.length < 11) {
      setError('يرجى إدخال رمز التفعيل كاملاً');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await previewAccessCode(accessCode);
      setPreview(result);
      setStep('confirm');
      setError(null);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'invalid_code';
      setError(ACCESS_CODE_ERROR_MESSAGES[code] || 'رمز التفعيل غير صحيح');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await loginWithAccessCode(accessCode, rememberMe);
      if (result.error) {
        setError(result.error);
        setStep('confirm');
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
        title={step === 'enter' ? 'تسجيل الدخول' : 'تأكيد الاشتراك'}
        subtitle={
          step === 'enter'
            ? 'أدخل رمز التفعيل الذي أرسله لك فريق المبيعات'
            : 'تحققنا من الرمز — هذه تفاصيل اشتراكك قبل التفعيل'
        }
        meta={
          env.VITE_SUPABASE_PUBLISHABLE_KEY === 'missing-anon-key' ? (
            <p className="text-xs text-destructive mt-2">إعدادات Supabase غير مكتملة — راجع ملف .env</p>
          ) : undefined
        }
      />

      {step === 'enter' ? (
        <form onSubmit={handleVerifyCode} className="space-y-5">
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
            <p className={authHintClass}>الخطوة 1: التحقق من الرمز</p>
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
                متابعة
                <ArrowLeft className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>
      ) : (
        <div className="space-y-5">
          {error && (
            <Alert variant="destructive" className="rounded-lg border text-right">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold text-sm">الرمز صحيح</span>
            </div>
            <p className="font-mono text-lg tracking-wider text-center" dir="ltr">
              {accessCode}
            </p>
            {preview && (
              <div className="rounded-xl border border-border/50 bg-background/80 px-3 py-3 text-sm space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">الباقة</span>
                  <span className="font-semibold">{planLabel(preview.planId)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">مدة الاشتراك</span>
                  <span className="font-semibold">{preview.durationMonths} شهر</span>
                </div>
                {preview.agreedPrice != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">السعر المتفق عليه</span>
                    <span className="font-semibold">
                      {preview.agreedPrice.toLocaleString('ar-IQ')} د.ع
                    </span>
                  </div>
                )}
                {preview.storeName && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">اسم المتجر</span>
                    <span className="font-semibold">{preview.storeName}</span>
                  </div>
                )}
              </div>
            )}
            <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-500/30">
              نفس مدة الصلاحية تُفعَّل عند الدخول
            </Badge>
          </div>

          <div className="flex flex-col gap-2">
            <Button className={authSubmitClass} disabled={isLoading} onClick={() => void handleActivate()}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  جارٍ التفعيل…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  تفعيل الحساب والدخول
                  <ArrowLeft className="h-4 w-4" />
                </span>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={isLoading}
              onClick={() => {
                setStep('enter');
                setPreview(null);
                setError(null);
              }}
            >
              تعديل الرمز
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            فقدت الرمز؟ تواصل مع فريق المبيعات لاستبداله برمز جديد بنفس الاشتراك.
          </p>
        </div>
      )}

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
