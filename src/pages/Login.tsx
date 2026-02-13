import { useState, useEffect } from "react";
import { ArrowLeft, Mail, Lock, Sparkles } from "lucide-react";
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
    <div className="min-h-screen bg-background flex flex-col font-arabic relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 py-6 px-6">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <ThemeToggle />
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">نومو</h1>
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md animate-fade-in">
          {/* Welcome text */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">مرحباً بعودتك 👋</h2>
            <p className="text-muted-foreground text-lg">سجّل دخولك لإدارة متجرك</p>
          </div>

          <div className="bg-card rounded-3xl shadow-lg border border-border/50 overflow-hidden">
            <form onSubmit={handleSubmit} className="p-8">
              {error && (
                <Alert className="mb-6 bg-destructive/10 border-destructive/20 text-right rounded-xl">
                  <AlertDescription className="text-destructive">⚠️ {error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-5">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-right text-foreground mb-2 font-medium text-sm">
                    البريد الإلكتروني
                  </label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="أدخل البريد الإلكتروني"
                      className="pl-12 pr-4 py-3 text-right bg-muted/50 border-border rounded-xl focus:border-primary focus:ring-primary text-foreground"
                      dir="rtl"
                      disabled={isLoading}
                    />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-right text-foreground mb-2 font-medium text-sm">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="أدخل كلمة المرور"
                      className="pl-12 pr-4 py-3 text-right bg-muted/50 border-border rounded-xl focus:border-primary focus:ring-primary text-foreground"
                      dir="rtl"
                      disabled={isLoading}
                    />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-end gap-2">
                  <label htmlFor="remember-me" className="text-sm text-muted-foreground cursor-pointer">
                    تذكر تسجيل الدخول
                  </label>
                  <Checkbox 
                    id="remember-me" 
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    disabled={isLoading}
                    className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </div>
              </div>

              {/* Submit */}
              <Button 
                type="submit" 
                className="w-full mt-8 bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-base font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
                disabled={isLoading}
              >
                <span className="ml-2">
                  {isLoading ? "جارٍ المعالجة..." : "تسجيل الدخول"}
                </span>
                <ArrowLeft className="h-4 w-4" />
              </Button>

              {/* Signup Link */}
              <div className="text-center mt-6">
                <p className="text-muted-foreground text-sm">
                  لا تملك حساب؟{" "}
                  <Link 
                    to="/signup" 
                    className="text-primary hover:text-primary/80 font-semibold transition-colors"
                  >
                    أنشئ حساب جديد
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center py-6 text-muted-foreground text-sm">
        <p>جميع الحقوق محفوظة © 2025 نومو</p>
      </footer>
    </div>
  );
};

export default Login;
