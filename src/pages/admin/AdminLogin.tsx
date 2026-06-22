import { useState, useEffect, type FormEvent } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { fetchMerchantAccess } from '@/services/subscriptionService';
import { useToast } from '@/hooks/use-toast';
import { AdminAuthShell, AdminAuthLoadingScreen } from '@/components/admin/AdminAuthShell';
import { AuthEmailField } from '@/components/auth/AuthFormFields';
import {
  authHintClass,
  authPasswordInputClass,
  authSubmitClass,
  authToggleButtonClass,
} from '@/components/auth/authFormStyles';
import { validateEmail, sanitizeInternalRedirect } from '@/lib/authUtils';
import { env } from '@/lib/env';

const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = sanitizeInternalRedirect((location.state as { from?: string } | null)?.from, '/admin/leads');
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const { login, user, loading, resendVerificationEmail, logout } = useAuth();
  const { isAdmin, loading: subLoading, refresh: refreshSubscription } = useSubscription();

  useEffect(() => {
    if (loading || subLoading) return;
    if (user && isAdmin) {
      navigate(from, { replace: true });
    }
  }, [user, loading, subLoading, isAdmin, navigate, from]);

  if (loading || subLoading) return <AdminAuthLoadingScreen />;

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
      if (user && !isAdmin) {
        await logout();
      }

      const result = await login(email, password, rememberMe);
      if (result.error) {
        setError(result.error);
        setEmailNotConfirmed(!!result.emailNotConfirmed);
        return;
      }

      await refreshSubscription();
      const access = await fetchMerchantAccess();

      if (!access.isAdmin) {
        setError('هذا الحساب غير مصرّح له بالدخول إلى لوحة الإدارة');
        await logout();
        return;
      }

      toast({ title: 'مرحباً', description: 'تم الدخول إلى لوحة المبيعات' });
      navigate(from, { replace: true });
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
    <AdminAuthShell>
      <div className="mb-6 space-y-1 text-center">
        <h1 className="text-xl font-bold text-slate-100">دخول المسؤولين</h1>
        <p className="text-sm text-slate-400">بريدك وكلمة المرور المُسجّلة في إعدادات المنصة</p>
        {env.VITE_SUPABASE_PUBLISHABLE_KEY === 'missing-anon-key' && (
          <p className="text-xs text-red-400 mt-2">إعدادات Supabase غير مكتملة — راجع ملف .env</p>
        )}
      </div>

      {user && !isAdmin && (
        <Alert className="mb-4 rounded-lg border-amber-500/30 bg-amber-500/10 text-right">
          <AlertDescription className="text-sm text-amber-100/90">
            أنت مسجّل كتاجر. سجّل الخروج أولاً أو استخدم حساب مسؤول.
          </AlertDescription>
        </Alert>
      )}

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
          id="admin-login-email"
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
              className="text-xs font-medium text-slate-300 hover:text-slate-100"
            >
              نسيت كلمة المرور؟
            </Link>
            <label htmlFor="admin-login-password" className="text-sm font-medium text-slate-200">
              كلمة المرور
            </label>
          </div>
          <div className="relative">
            <Input
              id="admin-login-password"
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
          <Label htmlFor="admin-remember-me" className="cursor-pointer text-sm font-normal text-slate-400">
            تذكرني على هذا الجهاز
          </Label>
          <Checkbox
            id="admin-remember-me"
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
              دخول لوحة الإدارة
              <ArrowLeft className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-500">
        تاجر؟{' '}
        <Link to="/login" className="font-medium text-slate-300 hover:text-slate-100">
          دخول المنصة برمز التفعيل
        </Link>
      </p>
    </AdminAuthShell>
  );
};

export default AdminLogin;
