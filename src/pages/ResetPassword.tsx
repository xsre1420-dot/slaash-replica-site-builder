import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";

const ResetPassword = () => {
  const { resetPassword, updatePassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"request" | "update">(
    window.location.hash.includes("type=recovery") ? "update" : "request"
  );
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("يرجى إدخال بريدك الإلكتروني");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("يرجى إدخال بريد إلكتروني صحيح");
      return;
    }
    setError(null);
    setLoading(true);
    const result = await resetPassword(email.trim());
    setLoading(false);
    if (result.error) setError(result.error);
    else toast.success("تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني");
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (password !== confirmPassword) {
      setError("كلمات المرور غير متطابقة");
      return;
    }
    setError(null);
    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);
    if (result.error) setError(result.error);
    else {
      toast.success("تم تحديث كلمة المرور بنجاح");
      window.location.href = "/login";
    }
  };

  return (
    <div className="min-h-screen bg-background font-arabic" dir="rtl">
      <header className="flex items-center justify-between px-4 py-4 border-b border-border/50">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← الرئيسية</Link>
        <ThemeToggle />
      </header>

      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {mode === "request" ? "نسيت كلمة المرور؟" : "تعيين كلمة مرور جديدة"}
            </h1>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
              {mode === "request"
                ? "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين"
                : "اختر كلمة مرور قوية جديدة لحسابك"}
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="rounded-xl">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {mode === "request" ? (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">البريد الإلكتروني</Label>
                <div className="relative">
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="text-right rounded-xl pl-10"
                    dir="ltr"
                    disabled={loading}
                  />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <Button type="submit" className="w-full rounded-xl min-h-[48px]" disabled={loading}>
                {loading ? "جاري الإرسال..." : "إرسال رابط إعادة التعيين"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="text-right rounded-xl pl-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="text-right rounded-xl pl-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={showConfirm ? "إخفاء تأكيد كلمة المرور" : "إظهار تأكيد كلمة المرور"}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full rounded-xl min-h-[48px]" disabled={loading}>
                {loading ? "جاري الحفظ..." : "حفظ كلمة المرور"}
              </Button>
            </form>
          )}

          <div className="text-center">
            <Link to="/login" className="text-sm text-primary hover:text-primary/80 inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              العودة لتسجيل الدخول
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
