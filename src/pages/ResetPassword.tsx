import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const ResetPassword = () => {
  const { resetPassword, updatePassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<"request" | "update">(
    window.location.hash.includes("type=recovery") ? "update" : "request"
  );
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const result = await resetPassword(email.trim());
    setLoading(false);
    if (result.error) toast.error(result.error);
    else toast.success("تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني");
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("كلمات المرور غير متطابقة");
      return;
    }
    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success("تم تحديث كلمة المرور بنجاح");
      window.location.href = "/login";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 font-arabic" dir="rtl">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {mode === "request" ? "نسيت كلمة المرور؟" : "تعيين كلمة مرور جديدة"}
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            {mode === "request"
              ? "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين"
              : "اختر كلمة مرور قوية جديدة"}
          </p>
        </div>

        {mode === "request" ? (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <Input
              type="email"
              placeholder="البريد الإلكتروني"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-right rounded-xl"
              dir="ltr"
              required
            />
            <Button type="submit" className="w-full rounded-xl" disabled={loading}>
              {loading ? "جاري الإرسال..." : "إرسال رابط إعادة التعيين"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <Input
              type="password"
              placeholder="كلمة المرور الجديدة"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-right rounded-xl"
              required
            />
            <Input
              type="password"
              placeholder="تأكيد كلمة المرور"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="text-right rounded-xl"
              required
            />
            <Button type="submit" className="w-full rounded-xl" disabled={loading}>
              {loading ? "جاري الحفظ..." : "حفظ كلمة المرور"}
            </Button>
          </form>
        )}

        <div className="text-center">
          <Link to="/login" className="text-sm text-primary hover:underline">
            العودة لتسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
