import { useState, useEffect, type FormEvent } from 'react';
import { ArrowLeft, Check, Mail, Store, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AuthPageShell, AuthLoadingScreen } from '@/components/auth/AuthPageShell';
import {
  AuthEmailField,
  AuthPageHeader,
  AuthPasswordField,
  AuthTextField,
} from '@/components/auth/AuthFormFields';
import { authSecondaryButtonClass, authSubmitClass } from '@/components/auth/authFormStyles';
import { getPasswordStrength, normalizeUsername, validateEmail, validateUsername, clearAuthUrlParams } from '@/lib/authUtils';
import { cn } from '@/lib/utils';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [storeName, setStoreName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(true);
  const [step, setStep] = useState(1);
  const [resending, setResending] = useState(false);

  const { register, user, loading, resendVerificationEmail, checkUsernameAvailable } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const selectedPlan = (location.state as { selectedPlan?: { id: string; name: string; price: string } })?.selectedPlan;

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/callback')) {
      const search = new URLSearchParams(window.location.search);
      if (search.has('code') || window.location.hash.includes('access_token')) {
        clearAuthUrlParams();
      }
    }
  }, []);

  useEffect(() => {
    if (!loading && user && !success && !needsVerification) {
      navigate('/builder', { replace: true });
    }
  }, [user, loading, success, needsVerification, navigate]);

  if (loading) return <AuthLoadingScreen />;

  const passwordStrength = getPasswordStrength(password);
  const strengthLabel = ['', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية'][passwordStrength];
  const strengthColor = ['', 'bg-destructive', 'bg-warning', 'bg-primary', 'bg-green-500'][passwordStrength];

  const validateStep1 = async () => {
    const emailErr = validateEmail(email);
    if (emailErr) {
      setError(emailErr);
      return false;
    }
    const userErr = validateUsername(username);
    if (userErr) {
      setError(userErr);
      return false;
    }

    setIsLoading(true);
    const { available } = await checkUsernameAvailable(normalizeUsername(username));
    setIsLoading(false);
    if (!available) {
      setError('اسم المستخدم مستخدم بالفعل — اختر اسماً آخر');
      return false;
    }

    setError(null);
    return true;
  };

  const handleNext = async () => {
    if (await validateStep1()) setStep(2);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('كلمات المرور غير متطابقة');
      return;
    }
    if (password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await register(
        email,
        password,
        normalizeUsername(username),
        storeName || 'متجري',
        selectedPlan?.id
      );
      if (result.error) {
        setError(result.error);
      } else {
        setNeedsVerification(result.needsEmailVerification !== false);
        setSuccess(true);
        toast({
          title: result.needsEmailVerification !== false ? 'تحقق من بريدك' : 'تم إنشاء حسابك',
          description:
            result.needsEmailVerification !== false
              ? 'أرسلنا رابط التأكيد إلى بريدك'
              : 'متجرك جاهز — مرحباً بك',
        });
      }
    } catch {
      setError('حدث خطأ غير متوقع');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    const result = await resendVerificationEmail(email);
    setResending(false);
    if (result.error) toast({ title: 'خطأ', description: result.error, variant: 'destructive' });
    else toast({ title: 'تم الإرسال', description: 'تحقق من بريدك الإلكتروني' });
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center font-arabic p-6" dir="rtl">
        <div className="w-full max-w-md text-center">
          <div className="rounded-xl border border-border bg-card p-8 sm:p-10 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {needsVerification ? 'تحقق من بريدك الإلكتروني' : 'تم إنشاء حسابك بنجاح'}
            </h2>
            {needsVerification ? (
              <>
                <p className="text-sm text-muted-foreground">تم إرسال رابط التأكيد إلى</p>
                <p className="text-sm font-medium text-foreground" dir="ltr">
                  {email}
                </p>
                <Button
                  variant="outline"
                  className={cn('w-full', authSecondaryButtonClass)}
                  disabled={resending}
                  onClick={handleResend}
                >
                  {resending ? 'جاري الإرسال…' : 'إعادة إرسال رسالة التحقق'}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">متجرك جاهز للاستخدام</p>
            )}
            <Link to={needsVerification ? '/login' : '/builder'}>
              <Button className={cn('w-full', authSubmitClass)}>
                {needsVerification ? 'العودة إلى تسجيل الدخول' : 'الذهاب إلى لوحة التحكم'}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthPageShell>
      <AuthPageHeader
        title="إنشاء حساب جديد"
        subtitle="أنشئ متجرك الإلكتروني في دقائق"
        meta={
          selectedPlan ? (
            <p className="mt-2 text-xs font-medium text-primary">
              الباقة: {selectedPlan.name} ({selectedPlan.price})
            </p>
          ) : undefined
        }
      />

      <div className="mb-7 flex items-center justify-center gap-3 sm:justify-start">
        <StepBadge n={1} label="المعلومات" active={step >= 1} done={step > 1} />
        <div className={cn('h-px w-10 rounded-full', step >= 2 ? 'bg-primary' : 'bg-border')} />
        <StepBadge n={2} label="كلمة المرور" active={step >= 2} done={false} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <Alert className="rounded-lg border border-destructive/20 bg-destructive/5 text-right">
            <AlertDescription className="text-sm text-destructive">{error}</AlertDescription>
          </Alert>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <AuthEmailField
              id="signup-email"
              label="البريد الإلكتروني *"
              value={email}
              onChange={setEmail}
              disabled={isLoading}
              required
            />
            <AuthTextField
              id="signup-username"
              label="اسم المستخدم *"
              value={username}
              onChange={setUsername}
              autoComplete="username"
              dir="ltr"
              icon={User}
              hint="3-30 حرف — a-z, 0-9, _ -"
              disabled={isLoading}
              required
            />
            <AuthTextField
              id="signup-store"
              label="اسم المتجر (اختياري)"
              value={storeName}
              onChange={setStoreName}
              placeholder="متجري"
              icon={Store}
              disabled={isLoading}
            />
            <Button type="button" onClick={handleNext} disabled={isLoading} className={authSubmitClass}>
              {isLoading ? (
                'جاري التحقق…'
              ) : (
                <span className="flex items-center justify-center gap-2">
                  التالي
                  <ArrowLeft className="h-4 w-4" />
                </span>
              )}
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <AuthPasswordField
              id="signup-password"
              label="كلمة المرور *"
              value={password}
              show={showPassword}
              onToggle={() => setShowPassword(!showPassword)}
              onChange={setPassword}
              disabled={isLoading}
              strength={passwordStrength}
              strengthLabel={strengthLabel}
              strengthColor={strengthColor}
              autoComplete="new-password"
            />
            <AuthPasswordField
              id="signup-confirm"
              label="تأكيد كلمة المرور *"
              value={confirmPassword}
              show={showConfirm}
              onToggle={() => setShowConfirm(!showConfirm)}
              onChange={setConfirmPassword}
              disabled={isLoading}
              match={confirmPassword ? confirmPassword === password : undefined}
              autoComplete="new-password"
            />
            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
                className={cn('flex-1', authSecondaryButtonClass)}
              >
                رجوع
              </Button>
              <Button type="submit" disabled={isLoading} className={cn('flex-[1.4]', authSubmitClass)}>
                {isLoading ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}
              </Button>
            </div>
          </div>
        )}
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        لديك حساب؟{' '}
        <Link to="/login" className="font-semibold text-primary hover:text-primary/80">
          سجّل الدخول
        </Link>
      </p>
    </AuthPageShell>
  );
};

const StepBadge = ({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) => (
  <div
    className={cn(
      'flex items-center gap-2 text-sm font-medium',
      active ? 'text-foreground' : 'text-muted-foreground'
    )}
  >
    <div
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      )}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : n}
    </div>
    <span>{label}</span>
  </div>
);

export default Signup;
