import { useState, useEffect } from "react";
import { ArrowLeft, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate, Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate("/builder");
    }
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
        toast({
          title: "تم تسجيل الدخول بنجاح",
          description: "مرحباً بك مرة أخرى"
        });
        navigate("/builder");
      }
    } catch (error) {
      console.error('Auth error:', error);
      setError("حدث خطأ غير متوقع");
    } finally {
      setIsLoading(false);
    }
  };

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
            <h2 className="text-3xl font-bold text-foreground mb-2">مرحباً بعودتك 👋</h2>
            <p className="text-muted-foreground">سجّل دخولك لإدارة متجرك</p>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
            <form onSubmit={handleSubmit} className="p-7">
              {error && (
                <Alert className="mb-5 bg-destructive/10 border-destructive/20 text-right rounded-xl">
                  <AlertDescription className="text-destructive text-sm">⚠️ {error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-right text-foreground mb-1.5 font-medium text-sm">
                    البريد الإلكتروني
                  </label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="أدخل البريد الإلكتروني"
                      className="pl-11 pr-4 py-2.5 text-right bg-muted/30 border-border rounded-xl focus:border-primary text-foreground"
                      dir="rtl"
                      disabled={isLoading}
                    />
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-right text-foreground mb-1.5 font-medium text-sm">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="أدخل كلمة المرور"
                      className="pl-11 pr-4 py-2.5 text-right bg-muted/30 border-border rounded-xl focus:border-primary text-foreground"
                      dir="rtl"
                      disabled={isLoading}
                    />
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <label htmlFor="remember-me" className="text-sm text-muted-foreground cursor-pointer">
                    تذكر تسجيل الدخول
                  </label>
                  <Checkbox 
                    id="remember-me" 
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full mt-6 bg-primary hover:bg-primary/90 text-primary-foreground py-3 font-semibold rounded-xl"
                disabled={isLoading}
              >
                <span className="ml-2">
                  {isLoading ? "جارٍ المعالجة..." : "تسجيل الدخول"}
                </span>
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div className="text-center mt-5">
                <p className="text-muted-foreground text-sm">
                  لا تملك حساب؟{" "}
                  <Link to="/signup" className="text-primary hover:text-primary/80 font-semibold">
                    أنشئ حساب جديد
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>

      <footer className="relative z-10 text-center py-5 text-muted-foreground text-xs">
        <p>جميع الحقوق محفوظة © 2025 بداية</p>
      </footer>
    </div>
  );
};

export default Login;
