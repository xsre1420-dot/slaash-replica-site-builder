import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, KeyRound, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { AuthPageShell, AuthLoadingScreen } from "@/components/auth/AuthPageShell";
import { usePasswordRecoveryMode } from "@/hooks/usePasswordRecoveryMode";
import { getPasswordStrength, validateEmail } from "@/lib/authUtils";

const ResetPassword = () => {
  const { resetPassword, updatePassword } = useAuth();
  const { mode } = usePasswordRecoveryMode();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const passwordStrength = getPasswordStrength(password);
  const strengthLabel = ["", "ضعيفة", "متوسطة", "جيدة", "قوية"][passwordStrength];

  if (mode === "checking") return <AuthLoadingScreen />;

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) { setError(emailError); return; }

    setError(null);
    setLoading(true);
    const result = await resetPassword(email.trim());
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setRequestSent(true);
      toast({ title: "تم الإرسال", description: "إذا كان البريد مسجلاً، ستصلك رسالة خلال دقائق" });
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }
    if (password !== confirmPassword) { setError("كلمات المرور غير متطابقة"); return; }

    setError(null);
    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      await supabase.auth.signOut();
      toast({ title: "تم بنجاح", description: "سجّل الدخول بكلمة المرور الجديدة" });
      navigate("/login?reset=success", { replace: true });
    }
  };

  const isUpdate = mode === "update";

  return (
    <AuthPageShell
      panelTitle={isUpdate ? "أمان حسابك" : "استعادة الوصول"}
      panelSubtitle={isUpdate ? "اختر كلمة مرور قوية جديدة" : "سنساعدك على العودة إلى متجرك"}
      panelContent={
        <div className="space-y-4 text-primary-foreground/80 text-sm">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 shrink-0" />
            <span>روابط إعادة التعيين صالحة لفترة محدودة</span>
          </div>
          <div className="flex items-center gap-3">
            <KeyRound className="w-5 h-5 shrink-0" />
            <span>استخدم 8 أحرف على الأقل لكلمة مرور آمنة</span>
          </div>
        </div>
      }
    >
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">
            {isUpdate ? "تعيين كلمة مرور جديدة" : "نسيت كلمة المرور؟"}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {isUpdate
              ? "أدخل كلمة مرور جديدة لحسابك"
              : requestSent
                ? "تحقق من بريدك — قد يستغرق الأمر بضع دقائق"
                : "أدخل بريدك وسنرسل رابط إعادة التعيين"}
          </p>
        </div>

        {error && (
          <Alert className="bg-destructive/10 border-destructive/20 rounded-xl mb-5 text-right">
            <AlertDescription className="text-destructive text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {!isUpdate ? (
          requestSent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground" dir="ltr">{email}</p>
              <Button variant="outline" className="w-full rounded-xl" onClick={() => { setRequestSent(false); setEmail(""); }}>
                إرسال إلى بريد آخر
              </Button>
            </div>
          ) : (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-right text-sm font-medium mb-2">البريد الإلكتروني</label>
                <div className="relative">
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 py-6 rounded-xl bg-muted/30 border-border/60"
                    dir="ltr"
                    disabled={loading}
                  />
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <Button type="submit" className="w-full rounded-xl min-h-[52px] font-bold" disabled={loading}>
                {loading ? "جاري الإرسال…" : "إرسال رابط إعادة التعيين"}
              </Button>
            </form>
          )
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <PasswordInput
              id="new-password"
              label="كلمة المرور الجديدة"
              value={password}
              show={showPassword}
              onToggle={() => setShowPassword(!showPassword)}
              onChange={setPassword}
              disabled={loading}
            />
            {password.length > 0 && (
              <p className="text-xs text-muted-foreground text-right">القوة: {strengthLabel}</p>
            )}
            <PasswordInput
              id="confirm-password"
              label="تأكيد كلمة المرور"
              value={confirmPassword}
              show={showConfirm}
              onToggle={() => setShowConfirm(!showConfirm)}
              onChange={setConfirmPassword}
              disabled={loading}
            />
            <Button type="submit" className="w-full rounded-xl min-h-[52px] font-bold" disabled={loading}>
              {loading ? "جاري الحفظ…" : "حفظ كلمة المرور"}
            </Button>
          </form>
        )}

        <div className="mt-8 text-center">
          <Link to="/login" className="text-sm text-primary hover:text-primary/80 inline-flex items-center gap-1 font-medium">
            <ArrowLeft className="w-4 h-4" />
            العودة لتسجيل الدخول
          </Link>
        </div>
      </motion.div>
    </AuthPageShell>
  );
};

const PasswordInput = ({
  id, label, value, show, onToggle, onChange, disabled,
}: {
  id: string; label: string; value: string; show: boolean;
  onToggle: () => void; onChange: (v: string) => void; disabled?: boolean;
}) => (
  <div>
    <label htmlFor={id} className="block text-right text-sm font-medium mb-2">{label}</label>
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-11 py-6 rounded-xl bg-muted/30 border-border/60"
        disabled={disabled}
        minLength={8}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground"
        aria-label={show ? "إخفاء" : "إظهار"}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  </div>
);

export default ResetPassword;
