import { useState, useEffect } from "react";
import { ArrowLeft, User, Lock, Mail, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate, Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

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

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/builder");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex flex-col font-arabic">
        <header className="bg-white/80 backdrop-blur-md text-gray-800 py-6 px-6 text-center border-b border-gray-100/50">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <div className="w-5 h-5 bg-white rounded-sm"></div>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">نومو</h1>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md text-center">
            <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100/50">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">تحقق من بريدك الإلكتروني</h2>
              <p className="text-gray-600 mb-6">
                تم إرسال رابط التأكيد إلى بريدك الإلكتروني. يرجى النقر على الرابط لتأكيد حسابك.
              </p>
              <Link 
                to="/login"
                className="inline-block bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
              >
                العودة إلى تسجيل الدخول
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            {/* Signup Header */}
            <div className="text-center p-8 bg-gradient-to-br from-primary to-secondary relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 backdrop-blur-sm"></div>
              <div className="relative z-10">
                <h2 className="text-3xl font-bold mb-3 text-white">
                  إنشاء حساب جديد
                </h2>
                <p className="text-white/90">
                  أنشئ متجرك الإلكتروني في دقائق
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
              <div className="mb-4">
                <label htmlFor="email" className="block text-right text-gray-700 mb-2 font-semibold text-sm">
                  البريد الإلكتروني *
                </label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="أدخل البريد الإلكتروني"
                    className="pl-10 pr-4 py-3 text-right text-gray-800 border-gray-200 rounded-xl focus:border-primary focus:ring-primary bg-gray-50/50"
                    dir="rtl"
                    disabled={isLoading}
                    required
                  />
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary h-4 w-4" />
                </div>
              </div>

              {/* Username Input */}
              <div className="mb-4">
                <label htmlFor="username" className="block text-right text-gray-700 mb-2 font-semibold text-sm">
                  اسم المستخدم *
                </label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="اختر اسم المستخدم"
                    className="pl-10 pr-4 py-3 text-right text-gray-800 border-gray-200 rounded-xl focus:border-primary focus:ring-primary bg-gray-50/50"
                    dir="rtl"
                    disabled={isLoading}
                    required
                  />
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary h-4 w-4" />
                </div>
              </div>

              {/* Store Name Input */}
              <div className="mb-4">
                <label htmlFor="storeName" className="block text-right text-gray-700 mb-2 font-semibold text-sm">
                  اسم المتجر (اختياري)
                </label>
                <div className="relative">
                  <Input
                    id="storeName"
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="اسم متجرك (افتراضي: متجري)"
                    className="pl-10 pr-4 py-3 text-right text-gray-800 border-gray-200 rounded-xl focus:border-primary focus:ring-primary bg-gray-50/50"
                    dir="rtl"
                    disabled={isLoading}
                  />
                  <Store className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary h-4 w-4" />
                </div>
              </div>

              {/* Password Input */}
              <div className="mb-4">
                <label htmlFor="password" className="block text-right text-gray-700 mb-2 font-semibold text-sm">
                  كلمة المرور *
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور (6 أحرف على الأقل)"
                    className="pl-10 pr-4 py-3 text-right text-gray-800 border-gray-200 rounded-xl focus:border-primary focus:ring-primary bg-gray-50/50"
                    dir="rtl"
                    disabled={isLoading}
                    required
                    minLength={6}
                  />
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary h-4 w-4" />
                </div>
              </div>

              {/* Confirm Password Input */}
              <div className="mb-6">
                <label htmlFor="confirmPassword" className="block text-right text-gray-700 mb-2 font-semibold text-sm">
                  تأكيد كلمة المرور *
                </label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد إدخال كلمة المرور"
                    className="pl-10 pr-4 py-3 text-right text-gray-800 border-gray-200 rounded-xl focus:border-primary focus:ring-primary bg-gray-50/50"
                    dir="rtl"
                    disabled={isLoading}
                    required
                  />
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary h-4 w-4" />
                </div>
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                disabled={isLoading}
              >
                <span className="ml-2">
                  {isLoading 
                    ? "جارٍ إنشاء الحساب..." 
                    : "إنشاء حساب جديد"
                  }
                </span>
                <ArrowLeft className="h-5 w-5" />
              </Button>

              {/* Login Link */}
              <div className="text-center mt-6">
                <p className="text-gray-600 text-sm">
                  لديك حساب بالفعل؟{" "}
                  <Link 
                    to="/login" 
                    className="text-primary hover:text-primary/80 font-semibold transition-colors"
                  >
                    سجل الدخول من هنا
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

export default Signup;