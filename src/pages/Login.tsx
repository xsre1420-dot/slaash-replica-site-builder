import { useState, useEffect } from "react";
import { ArrowLeft, User, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate, Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already logged in
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex flex-col font-arabic">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md text-gray-800 py-6 px-6 text-center border-b border-gray-100/50">
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg">
            <div className="w-5 h-5 bg-white rounded-sm"></div>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">نومو</h1>
        </div>
        <p className="text-sm text-gray-600 mt-2">منصة إدارة المتاجر الإلكترونية</p>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100/50 backdrop-blur-lg">
            {/* Login Header */}
            <div className="text-center p-8 bg-gradient-to-br from-primary to-secondary relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 backdrop-blur-sm"></div>
              <div className="relative z-10">
                <h2 className="text-3xl font-bold mb-3 text-white">
                  تسجيل الدخول
                </h2>
                <p className="text-white/90">
                  أدخل بيانات الدخول لإدارة متجرك الإلكتروني
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              {/* Error Alert */}
              {error && (
                <Alert className="mb-6 bg-red-50 border-red-200 text-right rounded-xl">
                  <div className="flex items-center">
                    <AlertDescription className="flex-1 text-red-800">⚠️ {error}</AlertDescription>
                  </div>
                </Alert>
              )}

              {/* Email Input */}
              <div className="mb-6">
                <label htmlFor="email" className="block text-right text-gray-700 mb-3 font-semibold">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="أدخل البريد الإلكتروني"
                    className="pl-12 pr-4 py-4 text-right text-gray-800 border-gray-200 rounded-xl focus:border-primary focus:ring-primary bg-gray-50/50 text-lg"
                    dir="rtl"
                    disabled={isLoading}
                  />
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-primary h-5 w-5" />
                </div>
              </div>

              {/* Password Input */}
              <div className="mb-6">
                <label htmlFor="password" className="block text-right text-gray-700 mb-3 font-semibold">
                  كلمة المرور
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور"
                    className="pl-12 pr-4 py-4 text-right text-gray-800 border-gray-200 rounded-xl focus:border-primary focus:ring-primary bg-gray-50/50 text-lg"
                    dir="rtl"
                    disabled={isLoading}
                  />
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-primary h-5 w-5" />
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-end mb-8">
                <label htmlFor="remember-me" className="ml-3 text-sm text-gray-600 font-medium">
                  تذكر تسجيل الدخول
                </label>
                <Checkbox 
                  id="remember-me" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  disabled={isLoading}
                  className="border-primary data-[state=checked]:bg-primary"
                />
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                disabled={isLoading}
              >
                <span className="ml-2">
                  {isLoading 
                    ? "جارٍ المعالجة..." 
                    : "تسجيل الدخول"
                  }
                </span>
                <ArrowLeft className="h-5 w-5" />
              </Button>

              {/* Signup Link */}
              <div className="text-center mt-6">
                <p className="text-gray-600 text-sm">
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
      <footer className="bg-white/80 backdrop-blur-md text-center py-6 text-gray-600 text-sm border-t border-gray-200/50">
        <p>جميع الحقوق محفوظة © 2025 نومو - منصة المتاجر الإلكترونية</p>
      </footer>
    </div>
  );
};

export default Login;