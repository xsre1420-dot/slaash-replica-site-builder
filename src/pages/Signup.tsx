import { useState, useEffect } from "react";
import { ArrowLeft, User, Lock, Mail, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate, Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [storeName, setStoreName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate("/builder");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim() || !username.trim()) {
      setError("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    if (password !== confirmPassword) {
      setError("كلمات المرور غير متطابقة");
      return;
    }

    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("يرجى إدخال بريد إلكتروني صحيح");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await register(email, password, username, storeName || 'متجري');

      if (result.error) {
        if (result.error.includes('already registered')) {
          setError("هذا البريد الإلكتروني مسجل بالفعل");
        } else if (result.error.includes('Password should be at least')) {
          setError("كلمة المرور ضعيفة جداً");
        } else {
          setError(result.error);
        }
      } else {
        setSuccess(true);
        toast({
          title: "تم إنشاء الحساب بنجاح",
          description: "يرجى التحقق من بريدك الإلكتروني لتأكيد الحساب"
        });
      }
    } catch (error) {
      console.error('Signup error:', error);
      setError("حدث خطأ غير متوقع");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col font-arabic" dir="rtl">
        <header className="py-5 px-6 border-b border-border/40">
          <div className="flex items-center justify-center">
            <img src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png" alt="بداية" className="h-8 w-auto" />
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md text-center">
            <div className="bg-card rounded-2xl border border-border/50 p-8">
              <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mx-auto mb-5">
                <Mail className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">تحقق من بريدك الإلكتروني</h2>
              <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                تم إرسال رابط التأكيد إلى بريدك الإلكتروني. يرجى النقر على الرابط لتأكيد حسابك.
              </p>
              <Link to="/login">
                <Button className="bg-primary text-primary-foreground rounded-xl px-8">
                  العودة إلى تسجيل الدخول
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-arabic" dir="rtl">
      {/* Header */}
      <header className="py-5 px-6 border-b border-border/40">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <Link to="/" className="flex items-center gap-2">
            <img src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png" alt="بداية" className="h-8 w-auto" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">إنشاء حساب جديد</h2>
            <p className="text-muted-foreground">أنشئ متجرك الإلكتروني في دقائق</p>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
            <form onSubmit={handleSubmit} className="p-7">
              {error && (
                <Alert className="mb-5 bg-destructive/10 border-destructive/20 text-right rounded-xl">
                  <AlertDescription className="text-destructive text-sm">⚠️ {error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <FormField id="email" label="البريد الإلكتروني *" icon={Mail}>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="أدخل البريد الإلكتروني"
                    className="pl-11 pr-4 py-2.5 text-right bg-muted/30 border-border rounded-xl focus:border-primary text-foreground"
                    dir="rtl"
                    disabled={isLoading}
                    required
                  />
                </FormField>

                <FormField id="username" label="اسم المستخدم *" icon={User}>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="اختر اسم المستخدم"
                    className="pl-11 pr-4 py-2.5 text-right bg-muted/30 border-border rounded-xl focus:border-primary text-foreground"
                    dir="rtl"
                    disabled={isLoading}
                    required
                  />
                </FormField>

                <FormField id="storeName" label="اسم المتجر (اختياري)" icon={Store}>
                  <Input
                    id="storeName"
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="اسم متجرك (افتراضي: متجري)"
                    className="pl-11 pr-4 py-2.5 text-right bg-muted/30 border-border rounded-xl focus:border-primary text-foreground"
                    dir="rtl"
                    disabled={isLoading}
                  />
                </FormField>

                <FormField id="password" label="كلمة المرور *" icon={Lock}>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور (6 أحرف على الأقل)"
                    className="pl-11 pr-4 py-2.5 text-right bg-muted/30 border-border rounded-xl focus:border-primary text-foreground"
                    dir="rtl"
                    disabled={isLoading}
                    required
                    minLength={6}
                  />
                </FormField>

                <FormField id="confirmPassword" label="تأكيد كلمة المرور *" icon={Lock}>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد إدخال كلمة المرور"
                    className="pl-11 pr-4 py-2.5 text-right bg-muted/30 border-border rounded-xl focus:border-primary text-foreground"
                    dir="rtl"
                    disabled={isLoading}
                    required
                  />
                </FormField>
              </div>

              <Button 
                type="submit" 
                className="w-full mt-6 bg-primary hover:bg-primary/90 text-primary-foreground py-3 font-semibold rounded-xl"
                disabled={isLoading}
              >
                <span className="ml-2">
                  {isLoading ? "جارٍ إنشاء الحساب..." : "إنشاء حساب جديد"}
                </span>
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div className="text-center mt-5">
                <p className="text-muted-foreground text-sm">
                  لديك حساب بالفعل؟{" "}
                  <Link to="/login" className="text-primary hover:text-primary/80 font-semibold">
                    سجل الدخول من هنا
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>

      <footer className="text-center py-5 text-muted-foreground text-xs">
        <p>جميع الحقوق محفوظة © 2025 بداية</p>
      </footer>
    </div>
  );
};

// Reusable form field component
const FormField = ({ id, label, icon: Icon, children }: { 
  id: string; 
  label: string; 
  icon: React.ComponentType<{ className?: string }>; 
  children: React.ReactNode 
}) => (
  <div>
    <label htmlFor={id} className="block text-right text-foreground mb-1.5 font-medium text-sm">
      {label}
    </label>
    <div className="relative">
      {children}
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
    </div>
  </div>
);

export default Signup;
