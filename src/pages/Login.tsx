
import { useState } from "react";
import { ArrowRight, User, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { loginUser, registerUser } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      setError("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = isRegistering 
        ? await registerUser(username, password)
        : await loginUser(username, password);

      if (result.error) {
        setError(result.error);
      } else if (result.user) {
        login(result.user);
        toast({
          title: isRegistering ? "تم إنشاء الحساب بنجاح" : "تم تسجيل الدخول بنجاح",
          description: `مرحباً ${result.user.username}`
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
    <div className="min-h-screen bg-white flex flex-col font-arabic">
      {/* Header */}
      <header className="bg-primary text-white py-4 px-6 text-center">
        <h1 className="text-xl font-bold flex items-center justify-center">
          نظام إدارة المطعم <span className="mx-2">🍽️</span>
        </h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
          {/* Login Header */}
          <div className="bg-primary text-white p-6 text-right">
            <h2 className="text-2xl font-bold mb-1">
              {isRegistering ? "إنشاء حساب جديد" : "تسجيل الدخول"}
            </h2>
            <p className="text-sm text-primary-foreground opacity-90">
              {isRegistering 
                ? "أدخل بيانات الحساب الجديد" 
                : "أدخل بيانات الدخول لإدارة مطعمك"
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            {/* Error Alert */}
            {error && (
              <Alert className="mb-6 bg-yellow-100 border-yellow-400 text-right">
                <div className="flex items-center">
                  <AlertDescription className="flex-1 text-primary-custom">⚠️ {error}</AlertDescription>
                </div>
              </Alert>
            )}

            {/* Username Input */}
            <div className="mb-6">
              <label htmlFor="username" className="block text-right text-primary-custom mb-2 font-medium">
                اسم المستخدم
              </label>
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم"
                  className="pl-10 text-right text-primary-custom border-gray-200"
                  dir="rtl"
                  disabled={isLoading}
                />
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary h-5 w-5" />
              </div>
            </div>

            {/* Password Input */}
            <div className="mb-6">
              <label htmlFor="password" className="block text-right text-primary-custom mb-2 font-medium">
                كلمة المرور
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  className="pl-10 text-right text-primary-custom border-gray-200"
                  dir="rtl"
                  disabled={isLoading}
                />
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary h-5 w-5" />
              </div>
            </div>

            {/* Remember Me Checkbox (only for login) */}
            {!isRegistering && (
              <div className="flex items-center justify-end mb-6">
                <label htmlFor="remember-me" className="ml-2 text-sm text-secondary-custom">
                  تذكر تسجيل الدخول
                </label>
                <Checkbox 
                  id="remember-me" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-secondary text-white py-3 text-lg font-medium"
              disabled={isLoading}
            >
              <span className="ml-2">
                {isLoading 
                  ? "جارٍ المعالجة..." 
                  : isRegistering 
                    ? "إنشاء الحساب" 
                    : "تسجيل الدخول"
                }
              </span>
              <ArrowRight className="h-5 w-5 transform rotate-180" />
            </Button>

            {/* Toggle between login and register */}
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError(null);
                }}
                className="text-secondary hover:text-primary hover:underline text-sm"
                disabled={isLoading}
              >
                {isRegistering 
                  ? "لديك حساب بالفعل؟ تسجيل الدخول" 
                  : "ليس لديك حساب؟ إنشاء حساب جديد"
                }
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white text-center py-4 text-secondary-custom text-sm border-t border-gray-200">
        <p>جميع الحقوق محفوظة © 2025 نظام إدارة المطعم</p>
      </footer>
    </div>
  );
};

export default Login;
