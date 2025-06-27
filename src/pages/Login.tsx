
import { useState } from "react";
import { ArrowRight, User, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Show error if username is empty (for demonstration purposes)
    if (!username.trim()) {
      setError("اسم المستخدم غير موجود");
      return;
    }
    
    // Clear any previous errors
    setError(null);
    
    // Handle login logic here (would connect to backend in a real app)
    console.log("Login attempt:", { username, password, rememberMe });
    
    // Navigate to dashboard on success (temporary for demo)
    if (username && password) {
      window.location.href = "/builder";
    }
  };

  return (
    <div className="min-h-screen bg-primary-custom flex flex-col font-arabic">
      {/* Header */}
      <header className="bg-primary text-primary-custom py-4 px-6 text-center">
        <h1 className="text-xl font-bold flex items-center justify-center">
          نظام إدارة المطعم <span className="mx-2">🍽️</span>
        </h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-primary-custom rounded-lg shadow-md overflow-hidden border border-primary">
          {/* Login Header */}
          <div className="bg-primary text-primary-custom p-6 text-right">
            <h2 className="text-2xl font-bold mb-1">تسجيل الدخول</h2>
            <p className="text-sm opacity-90">أدخل بيانات الدخول لإدارة مطعمك</p>
          </div>

          <form onSubmit={handleLogin} className="p-6">
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
                  className="pl-10 text-right text-primary-custom border-secondary"
                  dir="rtl"
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
                  className="pl-10 text-right text-primary-custom border-secondary"
                  dir="rtl"
                />
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary h-5 w-5" />
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-end mb-6">
              <label htmlFor="remember-me" className="ml-2 text-sm text-secondary-custom">
                تذكر تسجيل الدخول
              </label>
              <Checkbox 
                id="remember-me" 
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
            </div>

            {/* Login Button */}
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-secondary text-primary-custom py-3 text-lg font-medium"
            >
              <span className="ml-2">تسجيل الدخول</span>
              <ArrowRight className="h-5 w-5 transform rotate-180" />
            </Button>

            {/* Forgot Password */}
            <div className="text-center mt-4">
              <Link to="/forgot-password" className="text-secondary hover:text-primary hover:underline text-sm">
                نسيت كلمة المرور؟
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-primary-custom text-center py-4 text-secondary-custom text-sm border-t border-secondary">
        <p>جميع الحقوق محفوظة © 2025 نظام إدارة المطعم</p>
      </footer>
    </div>
  );
};

export default Login;
