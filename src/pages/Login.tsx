
import { useState, useEffect } from "react";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, ShoppingBag, BarChart3, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate, Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion } from "framer-motion";

const features = [
  { icon: ShoppingBag, title: "إدارة متجرك بسهولة", desc: "أضف منتجاتك وتابع طلباتك من مكان واحد" },
  { icon: BarChart3, title: "تحليلات متقدمة", desc: "تابع أداء متجرك بإحصائيات دقيقة ولحظية" },
  { icon: Palette, title: "تصميم احترافي", desc: "خصّص متجرك بألوان وتصاميم تعكس علامتك التجارية" },
];

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) navigate("/builder");
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await login(email, password);
      if (result.error) {
        setError(result.error);
      } else {
        toast({ title: "تم تسجيل الدخول بنجاح", description: "مرحباً بك مرة أخرى" });
        navigate("/builder");
      }
    } catch {
      setError("حدث خطأ غير متوقع");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background font-arabic" dir="rtl">
      <div className="flex min-h-screen">
        {/* Right side - Branding panel (hidden on mobile) */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-secondary" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
          <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-white/5 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-white/5 rounded-full blur-[100px]" />

          <div className="relative z-10 flex flex-col justify-center p-16 text-primary-foreground">
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
              <img src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png" alt="بداية" className="h-12 w-auto mb-12 brightness-0 invert" />
              <h1 className="text-4xl font-bold mb-4 leading-tight">مرحباً بعودتك</h1>
              <p className="text-lg text-primary-foreground/70 mb-12">سجّل دخولك وتابع إدارة متجرك الإلكتروني</p>

              <div className="space-y-6">
                {features.map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 + i * 0.15 }}
                    className="flex items-start gap-4 group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-white/15 transition-colors">
                      <f.icon className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-0.5">{f.title}</h3>
                      <p className="text-sm text-primary-foreground/60">{f.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Left side - Form */}
        <div className="w-full lg:w-1/2 flex flex-col">
          <header className="py-5 px-6 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 lg:hidden">
              <img src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png" alt="بداية" className="h-8 w-auto" />
            </Link>
            <Link to="/" className="hidden lg:block text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← العودة للرئيسية
            </Link>
            <ThemeToggle />
          </header>

          <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-[420px]"
            >
              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <Lock className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-3xl font-bold text-foreground mb-2">تسجيل الدخول</h2>
                <p className="text-muted-foreground text-sm">أدخل بياناتك للوصول إلى لوحة التحكم</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    <Alert className="bg-destructive/10 border-destructive/20 text-right rounded-xl">
                      <AlertDescription className="text-destructive text-sm">⚠️ {error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}

                <div>
                  <label htmlFor="email" className="block text-right text-foreground mb-2 font-medium text-sm">
                    البريد الإلكتروني
                  </label>
                  <div className="relative group">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      className="pl-11 pr-4 py-6 text-right bg-muted/30 border-border/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 text-foreground transition-all"
                      dir="rtl"
                      disabled={isLoading}
                    />
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground h-4.5 w-4.5 group-focus-within:text-primary transition-colors" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <button type="button" className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                      نسيت كلمة المرور؟
                    </button>
                    <label htmlFor="password" className="text-foreground font-medium text-sm">
                      كلمة المرور
                    </label>
                  </div>
                  <div className="relative group">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-20 pr-4 py-6 text-right bg-muted/30 border-border/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 text-foreground transition-all"
                      dir="rtl"
                      disabled={isLoading}
                    />
                    <Lock className="absolute left-11 top-1/2 -translate-y-1/2 text-muted-foreground h-4.5 w-4.5 group-focus-within:text-primary transition-colors" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <label htmlFor="remember-me" className="text-sm text-muted-foreground cursor-pointer select-none">
                    تذكرني
                  </label>
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    disabled={isLoading}
                    className="border-border/60"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 font-bold rounded-xl shadow-lg shadow-primary/15 hover:shadow-primary/25 transition-all duration-300 text-base"
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
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/40" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-background px-4 text-muted-foreground">أو</span>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm">
                  ليس لديك حساب؟{" "}
                  <Link to="/signup" className="text-primary hover:text-primary/80 font-bold transition-colors">
                    أنشئ حساب مجاني
                  </Link>
                </p>
              </div>
            </motion.div>
          </div>

          <footer className="text-center py-5 text-muted-foreground/50 text-xs">
            جميع الحقوق محفوظة © 2025 بداية
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Login;
