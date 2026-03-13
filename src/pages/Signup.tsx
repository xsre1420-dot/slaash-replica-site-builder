
import { useState, useEffect } from "react";
import { ArrowLeft, User, Lock, Mail, Store, Eye, EyeOff, Check, Shield, Zap, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate, Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion } from "framer-motion";

const benefits = [
  { icon: Zap, text: "إعداد المتجر خلال 60 ثانية فقط" },
  { icon: Shield, text: "حماية كاملة لبياناتك وبيانات عملائك" },
  { icon: Globe, text: "رابط متجر خاص بك جاهز للمشاركة فوراً" },
];

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
  const [step, setStep] = useState(1);

  const { register, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) navigate("/builder");
  }, [user, navigate]);

  const passwordStrength = (() => {
    if (password.length === 0) return 0;
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return Math.min(s, 4);
  })();

  const strengthLabel = ["", "ضعيفة", "متوسطة", "جيدة", "قوية"][passwordStrength];
  const strengthColor = ["", "bg-destructive", "bg-warning", "bg-primary", "bg-green-500"][passwordStrength];

  const validateStep1 = () => {
    if (!email.trim() || !username.trim()) {
      setError("يرجى ملء جميع الحقول المطلوبة");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("يرجى إدخال بريد إلكتروني صحيح");
      return false;
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (validateStep1()) setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError("كلمات المرور غير متطابقة"); return; }
    if (password.length < 6) { setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }

    setIsLoading(true);
    setError(null);
    try {
      const result = await register(email, password, username, storeName || 'متجري');
      if (result.error) {
        if (result.error.includes('already registered')) setError("هذا البريد الإلكتروني مسجل بالفعل");
        else if (result.error.includes('Password should be at least')) setError("كلمة المرور ضعيفة جداً");
        else setError(result.error);
      } else {
        setSuccess(true);
        toast({ title: "تم إنشاء الحساب بنجاح", description: "يرجى التحقق من بريدك الإلكتروني لتأكيد الحساب" });
      }
    } catch {
      setError("حدث خطأ غير متوقع");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center font-arabic p-6" dir="rtl">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md text-center">
          <div className="bg-card rounded-3xl border border-border/40 p-10 shadow-xl">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Mail className="w-9 h-9 text-primary" />
            </motion.div>
            <h2 className="text-2xl font-bold text-foreground mb-3">تحقق من بريدك الإلكتروني</h2>
            <p className="text-muted-foreground mb-2 text-sm leading-relaxed">
              تم إرسال رابط التأكيد إلى
            </p>
            <p className="text-foreground font-semibold mb-6 text-sm" dir="ltr">{email}</p>
            <Link to="/login">
              <Button className="bg-primary text-primary-foreground rounded-xl px-10 py-5 font-bold shadow-lg shadow-primary/15">
                العودة إلى تسجيل الدخول
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-arabic" dir="rtl">
      <div className="flex min-h-screen">
        {/* Right side - Branding panel */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-secondary" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
          <div className="absolute top-1/3 right-1/3 w-[400px] h-[400px] bg-white/5 rounded-full blur-[100px]" />

          <div className="relative z-10 flex flex-col justify-center p-16 text-primary-foreground">
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
              <img src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png" alt="بداية" className="h-12 w-auto mb-12 brightness-0 invert" />
              <h1 className="text-4xl font-bold mb-4 leading-tight">ابدأ رحلتك التجارية</h1>
              <p className="text-lg text-primary-foreground/70 mb-14">أنشئ متجرك الإلكتروني واحصل على كل الأدوات التي تحتاجها</p>

              <div className="space-y-5">
                {benefits.map((b, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 + i * 0.15 }}
                    className="flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                      <b.icon className="w-5 h-5" />
                    </div>
                    <span className="font-medium">{b.text}</span>
                  </motion.div>
                ))}
              </div>

              <div className="mt-16 p-5 bg-white/10 rounded-2xl border border-white/10">
                <p className="text-sm text-primary-foreground/80 leading-relaxed">
                  "منصة بداية غيّرت طريقة إدارتي لمتجري بالكامل. سهلة الاستخدام وتوفر كل ما أحتاجه."
                </p>
                <p className="text-xs text-primary-foreground/50 mt-3">— أحمد، صاحب متجر إلكتروني</p>
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
                  <User className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-3xl font-bold text-foreground mb-2">إنشاء حساب جديد</h2>
                <p className="text-muted-foreground text-sm">أنشئ متجرك الإلكتروني في دقائق</p>
              </div>

              {/* Step indicator */}
              <div className="flex items-center gap-3 mb-8 justify-center">
                <div className={`flex items-center gap-2 text-sm font-medium ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {step > 1 ? <Check className="w-4 h-4" /> : '1'}
                  </div>
                  المعلومات
                </div>
                <div className={`w-12 h-0.5 rounded ${step >= 2 ? 'bg-primary' : 'bg-border'} transition-colors`} />
                <div className={`flex items-center gap-2 text-sm font-medium ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    2
                  </div>
                  كلمة المرور
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
                    <Alert className="bg-destructive/10 border-destructive/20 text-right rounded-xl">
                      <AlertDescription className="text-destructive text-sm">⚠️ {error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <FieldWrapper label="البريد الإلكتروني *" icon={Mail}>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@email.com"
                        className="pl-11 pr-4 py-6 text-right bg-muted/30 border-border/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 text-foreground transition-all"
                        dir="rtl"
                        disabled={isLoading}
                        required
                      />
                    </FieldWrapper>

                    <FieldWrapper label="اسم المستخدم *" icon={User}>
                      <Input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="اختر اسم المستخدم"
                        className="pl-11 pr-4 py-6 text-right bg-muted/30 border-border/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 text-foreground transition-all"
                        dir="rtl"
                        disabled={isLoading}
                        required
                      />
                    </FieldWrapper>

                    <FieldWrapper label="اسم المتجر (اختياري)" icon={Store}>
                      <Input
                        type="text"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        placeholder="متجري"
                        className="pl-11 pr-4 py-6 text-right bg-muted/30 border-border/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 text-foreground transition-all"
                        dir="rtl"
                        disabled={isLoading}
                      />
                    </FieldWrapper>

                    <Button
                      type="button"
                      onClick={handleNext}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 font-bold rounded-xl shadow-lg shadow-primary/15 text-base mt-2"
                    >
                      التالي
                      <ArrowLeft className="h-4 w-4 mr-2" />
                    </Button>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-right text-foreground mb-2 font-medium text-sm">كلمة المرور *</label>
                      <div className="relative group">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="6 أحرف على الأقل"
                          className="pl-20 pr-4 py-6 text-right bg-muted/30 border-border/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 text-foreground transition-all"
                          dir="rtl"
                          disabled={isLoading}
                          required
                          minLength={6}
                        />
                        <Lock className="absolute left-11 top-1/2 -translate-y-1/2 text-muted-foreground h-4.5 w-4.5 group-focus-within:text-primary transition-colors" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {password.length > 0 && (
                        <div className="mt-2.5 space-y-1.5">
                          <div className="flex gap-1.5">
                            {[1, 2, 3, 4].map(i => (
                              <div key={i} className={`h-1.5 rounded-full flex-1 transition-all ${i <= passwordStrength ? strengthColor : 'bg-border'}`} />
                            ))}
                          </div>
                          <p className={`text-xs text-left ${passwordStrength <= 1 ? 'text-destructive' : passwordStrength <= 2 ? 'text-warning' : 'text-primary'}`} dir="rtl">
                            قوة كلمة المرور: {strengthLabel}
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-right text-foreground mb-2 font-medium text-sm">تأكيد كلمة المرور *</label>
                      <div className="relative group">
                        <Input
                          type={showConfirm ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="أعد إدخال كلمة المرور"
                          className={`pl-20 pr-4 py-6 text-right bg-muted/30 border-border/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 text-foreground transition-all ${confirmPassword && confirmPassword !== password ? 'border-destructive/50' : confirmPassword && confirmPassword === password ? 'border-primary/50' : ''}`}
                          dir="rtl"
                          disabled={isLoading}
                          required
                        />
                        <Lock className="absolute left-11 top-1/2 -translate-y-1/2 text-muted-foreground h-4.5 w-4.5 group-focus-within:text-primary transition-colors" />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {confirmPassword && confirmPassword !== password && (
                        <p className="text-xs text-destructive mt-1.5">كلمات المرور غير متطابقة</p>
                      )}
                      {confirmPassword && confirmPassword === password && (
                        <p className="text-xs text-primary mt-1.5 flex items-center gap-1 justify-end">
                          <Check className="w-3 h-3" /> متطابقة
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => { setStep(1); setError(null); }}
                        className="py-6 rounded-xl border-border/60 text-muted-foreground"
                      >
                        رجوع
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-6 font-bold rounded-xl shadow-lg shadow-primary/15 text-base"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            جارٍ الإنشاء...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            إنشاء الحساب
                            <ArrowLeft className="h-4 w-4" />
                          </span>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}
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
                  لديك حساب بالفعل؟{" "}
                  <Link to="/login" className="text-primary hover:text-primary/80 font-bold transition-colors">
                    سجّل الدخول
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

const FieldWrapper = ({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) => (
  <div>
    <label className="block text-right text-foreground mb-2 font-medium text-sm">{label}</label>
    <div className="relative group">
      {children}
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground h-4.5 w-4.5 group-focus-within:text-primary transition-colors" />
    </div>
  </div>
);

export default Signup;
