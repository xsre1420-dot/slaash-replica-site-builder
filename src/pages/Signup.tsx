import { useState, useEffect } from "react";
import { ArrowLeft, User, Lock, Mail, Store, Eye, EyeOff, Check, Shield, Zap, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { AuthPageShell, AuthLoadingScreen } from "@/components/auth/AuthPageShell";
import { getPasswordStrength, normalizeUsername, validateEmail, validateUsername } from "@/lib/authUtils";

const benefits = [
  { icon: Zap, text: "إعداد المتجر خلال 60 ثانية فقط" },
  { icon: Shield, text: "حماية كاملة لبياناتك وبيانات عملائك" },
  { icon: Globe, text: "رابط متجر خاص بك جاهز للمشاركة فوراً" },
];

const inputClass = "pl-11 pr-4 py-6 text-right bg-muted/30 border-border/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 text-foreground transition-all";
const submitClass = "w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 font-bold rounded-xl shadow-lg shadow-primary/15 text-base";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [storeName, setStoreName] = useState("");
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
    if (!loading && user && !success && !needsVerification) {
      navigate("/builder", { replace: true });
    }
  }, [user, loading, success, needsVerification, navigate]);

  if (loading) return <AuthLoadingScreen />;

  const passwordStrength = getPasswordStrength(password);
  const strengthLabel = ["", "ضعيفة", "متوسطة", "جيدة", "قوية"][passwordStrength];
  const strengthColor = ["", "bg-destructive", "bg-warning", "bg-primary", "bg-green-500"][passwordStrength];

  const validateStep1 = async () => {
    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return false; }
    const userErr = validateUsername(username);
    if (userErr) { setError(userErr); return false; }

    setIsLoading(true);
    const { available } = await checkUsernameAvailable(normalizeUsername(username));
    setIsLoading(false);
    if (!available) {
      setError("اسم المستخدم مستخدم بالفعل — اختر اسماً آخر");
      return false;
    }

    setError(null);
    return true;
  };

  const handleNext = async () => {
    if (await validateStep1()) setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError("كلمات المرور غير متطابقة"); return; }
    if (password.length < 8) { setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }

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
          title: result.needsEmailVerification !== false ? "تحقق من بريدك" : "تم إنشاء حسابك",
          description: result.needsEmailVerification !== false
            ? "أرسلنا رابط التأكيد إلى بريدك"
            : "متجرك جاهز — مرحباً بك",
        });
      }
    } catch {
      setError("حدث خطأ غير متوقع");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    const result = await resendVerificationEmail(email);
    setResending(false);
    if (result.error) toast({ title: "خطأ", description: result.error, variant: "destructive" });
    else toast({ title: "تم الإرسال", description: "تحقق من بريدك الإلكتروني" });
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center font-arabic p-6" dir="rtl">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md text-center">
          <div className="bg-card rounded-3xl border border-border/40 p-10 shadow-xl space-y-4">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-9 h-9 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              {needsVerification ? "تحقق من بريدك الإلكتروني" : "تم إنشاء حسابك بنجاح"}
            </h2>
            {needsVerification ? (
              <>
                <p className="text-muted-foreground text-sm">تم إرسال رابط التأكيد إلى</p>
                <p className="text-foreground font-semibold text-sm" dir="ltr">{email}</p>
                <Button variant="outline" className="w-full rounded-xl" disabled={resending} onClick={handleResend}>
                  {resending ? 'جاري الإرسال…' : 'إعادة إرسال رسالة التحقق'}
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">متجرك جاهز للاستخدام</p>
            )}
            <Link to={needsVerification ? "/login" : "/builder"}>
              <Button className="w-full bg-primary text-primary-foreground rounded-xl py-5 font-bold shadow-lg shadow-primary/15">
                {needsVerification ? "العودة إلى تسجيل الدخول" : "الذهاب إلى لوحة التحكم"}
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <AuthPageShell
      panelTitle="ابدأ رحلتك التجارية"
      panelSubtitle="أنشئ متجرك الإلكتروني واحصل على كل الأدوات التي تحتاجها"
      panelContent={
        <>
          <div className="space-y-5 mb-16">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <b.icon className="w-5 h-5" />
                </div>
                <span className="font-medium">{b.text}</span>
              </div>
            ))}
          </div>
          <div className="p-5 bg-white/10 rounded-2xl border border-white/10">
            <p className="text-sm text-primary-foreground/80 leading-relaxed">
              "منصة بداية غيّرت طريقة إدارتي لمتجري بالكامل. سهلة الاستخدام وتوفر كل ما أحتاجه."
            </p>
          </div>
        </>
      }
    >
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <User className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">إنشاء حساب جديد</h2>
          <p className="text-muted-foreground text-sm">أنشئ متجرك الإلكتروني في 60 ثانية</p>
          {selectedPlan && (
            <p className="text-xs text-primary mt-2 font-medium">
              الباقة: {selectedPlan.name} ({selectedPlan.price})
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 mb-8 justify-center">
          <StepBadge n={1} label="المعلومات" active={step >= 1} done={step > 1} />
          <div className={`w-12 h-0.5 rounded ${step >= 2 ? 'bg-primary' : 'bg-border'}`} />
          <StepBadge n={2} label="كلمة المرور" active={step >= 2} done={false} />
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <Alert className="bg-destructive/10 border-destructive/20 text-right rounded-xl mb-5">
              <AlertDescription className="text-destructive text-sm">⚠️ {error}</AlertDescription>
            </Alert>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <AuthField id="signup-email" label="البريد الإلكتروني *" icon={Mail}>
                <Input id="signup-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} dir="ltr" disabled={isLoading} required />
              </AuthField>
              <AuthField id="signup-username" label="اسم المستخدم *" icon={User}>
                <Input id="signup-username" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} dir="ltr" disabled={isLoading} required />
              </AuthField>
              <p className="text-[11px] text-muted-foreground text-right">3-30 حرف — a-z, 0-9, _ -</p>
              <AuthField id="signup-store" label="اسم المتجر (اختياري)" icon={Store}>
                <Input id="signup-store" type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} className={inputClass} disabled={isLoading} placeholder="متجري" />
              </AuthField>
              <Button type="button" onClick={handleNext} disabled={isLoading} className={submitClass}>
                {isLoading ? 'جاري التحقق…' : 'التالي'}
                {!isLoading && <ArrowLeft className="h-4 w-4 mr-2" />}
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <PasswordField id="signup-password" label="كلمة المرور *" value={password} show={showPassword} onToggle={() => setShowPassword(!showPassword)} onChange={setPassword} disabled={isLoading} inputClass={inputClass} strength={passwordStrength} strengthLabel={strengthLabel} strengthColor={strengthColor} />
              <PasswordField id="signup-confirm" label="تأكيد كلمة المرور *" value={confirmPassword} show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} onChange={setConfirmPassword} disabled={isLoading} inputClass={inputClass} match={confirmPassword ? confirmPassword === password : undefined} />
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => { setStep(1); setError(null); }} className="py-6 rounded-xl">رجوع</Button>
                <Button type="submit" disabled={isLoading} className={`flex-1 ${submitClass}`}>
                  {isLoading ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}
                </Button>
              </div>
            </div>
          )}
        </form>

        <p className="mt-8 text-center text-muted-foreground text-sm">
          لديك حساب؟ <Link to="/login" className="text-primary font-bold">سجّل الدخول</Link>
        </p>
      </motion.div>
    </AuthPageShell>
  );
};

const StepBadge = ({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) => (
  <div className={`flex items-center gap-2 text-sm font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
      {done ? <Check className="w-4 h-4" /> : n}
    </div>
    {label}
  </div>
);

const AuthField = ({ id, label, icon: Icon, children }: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) => (
  <div>
    <label htmlFor={id} className="block text-right text-foreground mb-2 font-medium text-sm">{label}</label>
    <div className="relative group">
      {children}
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 group-focus-within:text-primary transition-colors" />
    </div>
  </div>
);

const PasswordField = ({
  id, label, value, show, onToggle, onChange, disabled, inputClass, strength, strengthLabel, strengthColor, match,
}: {
  id: string; label: string; value: string; show: boolean; onToggle: () => void; onChange: (v: string) => void;
  disabled?: boolean; inputClass: string; strength?: number; strengthLabel?: string; strengthColor?: string; match?: boolean;
}) => (
  <div>
    <label htmlFor={id} className="block text-right text-foreground mb-2 font-medium text-sm">{label}</label>
    <div className="relative group">
      <Input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} pl-20 ${match === false ? 'border-destructive/50' : match ? 'border-primary/50' : ''}`} disabled={disabled} minLength={8} required />
      <Lock className="absolute left-11 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
      <button type="button" onClick={onToggle} className="absolute left-3.5 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground" aria-label={show ? 'إخفاء' : 'إظهار'}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
    {strength !== undefined && value && strengthLabel && strengthColor && (
      <div className="mt-2 space-y-1">
        <div className="flex gap-1">{[1, 2, 3, 4].map((i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= strength ? strengthColor : 'bg-border'}`} />)}</div>
        <p className="text-xs text-right text-muted-foreground">قوة كلمة المرور: {strengthLabel}</p>
      </div>
    )}
    {match === false && <p className="text-xs text-destructive mt-1 text-right">كلمات المرور غير متطابقة</p>}
    {match === true && <p className="text-xs text-primary mt-1 text-right flex items-center gap-1 justify-end"><Check className="w-3 h-3" /> متطابقة</p>}
  </div>
);

export default Signup;
