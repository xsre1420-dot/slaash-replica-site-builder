import { useState, useEffect, type FormEvent } from "react";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, ShoppingBag, BarChart3, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { AuthPageShell, AuthLoadingScreen } from "@/components/auth/AuthPageShell";
import { clearAuthUrlParams, parseAuthUrlError, validateEmail } from "@/lib/authUtils";
import { env } from "@/lib/env";

/** Remove stray auth callback params that crash auth pages when auto-processed */
const sanitizeAuthPageUrl = () => {
  if (typeof window === 'undefined') return;
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

const features = [
  { icon: ShoppingBag, title: "إدارة متجرك بسهولة", desc: "أضف منتجاتك وتابع طلباتك من مكان واحد" },
  { icon: BarChart3, title: "تحليلات متقدمة", desc: "تابع أداء متجرك بإحصائيات دقيقة ولحظية" },
  { icon: Palette, title: "تصميم احترافي", desc: "خصّص متجرك بألوان وتصاميم تعكس علامتك التجارية" },
];

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const { login, user, loading, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/builder";
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
    if (emailError) { setError(emailError); return; }
    if (!password.trim()) { setError("يرجى إدخال كلمة المرور"); return; }

    setIsLoading(true);
    setError(null);
    setEmailNotConfirmed(false);

    try {
      const result = await login(email, password, rememberMe);
      if (result.error) {
        setError(result.error);
        setEmailNotConfirmed(!!result.emailNotConfirmed);
      } else {
        toast({ title: "تم تسجيل الدخول بنجاح", description: "مرحباً بك مرة أخرى" });
        navigate(from, { replace: true });
      }
    } catch {
      setError("حدث خطأ غير متوقع");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    const result = await resendVerificationEmail(email);
    setResending(false);
    if (result.error) {
      toast({ title: "خطأ", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "تم الإرسال", description: "تحقق من بريدك الإلكتروني" });
    }
  };

  return (
    <AuthPageShell
      panelTitle="مرحباً بعودتك"
      panelSubtitle="سجّل دخولك وتابع إدارة متجرك الإلكتروني"
      panelContent={
        <div className="space-y-6">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <f.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold mb-0.5">{f.title}</h3>
                <p className="text-sm text-primary-foreground/60">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      }
    >
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">تسجيل الدخول</h2>
          <p className="text-muted-foreground text-sm">أدخل بياناتك للوصول إلى لوحة التحكم</p>
          {env.VITE_SUPABASE_PUBLISHABLE_KEY === 'missing-anon-key' && (
            <p className="text-xs text-destructive mt-2">إعدادات Supabase غير مكتملة — راجع ملف .env</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <Alert variant="destructive" className="text-right rounded-xl">
              <AlertDescription className="text-sm space-y-2">
                <p>{error}</p>
                {emailNotConfirmed && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full rounded-lg border-destructive/30"
                    disabled={resending}
                    onClick={handleResendVerification}
                  >
                    {resending ? 'جاري الإرسال…' : 'إعادة إرسال رسالة التحقق'}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div>
            <label htmlFor="email" className="block text-right text-foreground mb-2 font-medium text-sm">
              البريد الإلكتروني
            </label>
            <div className="relative group">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="pl-11 pr-4 py-6 text-right bg-muted/30 border-border/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10"
                dir="ltr"
                disabled={isLoading}
              />
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 group-focus-within:text-primary transition-colors" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Link to="/reset-password" className="text-xs text-primary hover:text-primary/80 font-medium">
                نسيت كلمة المرور؟
              </Link>
              <label htmlFor="password" className="text-foreground font-medium text-sm">كلمة المرور</label>
            </div>
            <div className="relative group">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-20 pr-4 py-6 text-right bg-muted/30 border-border/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10"
                disabled={isLoading}
              />
              <Lock className="absolute left-11 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 group-focus-within:text-primary transition-colors" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 text-right">8 أحرف على الأقل</p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Label htmlFor="remember-me" className="text-sm text-muted-foreground cursor-pointer">
              تذكرني على هذا الجهاز
            </Label>
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(v) => setRememberMe(v === true)}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 font-bold rounded-xl shadow-lg shadow-primary/15 text-base"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                جارٍ تسجيل الدخول...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                تسجيل الدخول
                <ArrowLeft className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-muted-foreground text-sm">
            ليس لديك حساب؟{" "}
            <Link to="/signup" className="text-primary hover:text-primary/80 font-bold">
              أنشئ حساب مجاني
            </Link>
          </p>
        </div>
      </motion.div>
    </AuthPageShell>
  );
};

export default Login;

function mapAuthUrlError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('email not confirmed')) return 'يرجى تأكيد بريدك الإلكتروني أولاً';
  if (m.includes('invalid') && m.includes('code')) return 'انتهت صلاحية رابط الدخول. حاول تسجيل الدخول يدوياً';
  return message.length > 120 ? 'تعذر إكمال تسجيل الدخول. حاول مرة أخرى' : message;
}
