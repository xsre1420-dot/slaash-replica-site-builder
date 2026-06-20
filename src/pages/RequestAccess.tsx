import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, User, Phone, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { AuthPageHeader, AuthTextField } from '@/components/auth/AuthFormFields';
import { authSubmitClass } from '@/components/auth/authFormStyles';
import { submitAccessLead, LeadSubmitError } from '@/services/leadAdminService';
import { Alert, AlertDescription } from '@/components/ui/alert';

const RequestAccess = () => {
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await submitAccessLead(fullName, whatsapp);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof LeadSubmitError ? err.message : 'حدث خطأ، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthPageShell>
        <div className="text-center space-y-6 py-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold font-arabic">شكراً لك!</h1>
            <p className="text-muted-foreground font-arabic leading-relaxed max-w-sm mx-auto">
              سيقوم فريقنا بالتواصل معك عبر واتساب قريباً لمناقشة الباقة المناسبة لمتجرك.
            </p>
          </div>
          <Link to="/">
            <Button variant="outline" className="rounded-xl font-arabic">
              العودة للرئيسية
            </Button>
          </Link>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <AuthPageHeader
        title="اطلب الوصول للمنصة"
        subtitle="أدخل بياناتك وسيتواصل معك فريق المبيعات عبر واتساب"
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AuthTextField
          id="fullName"
          label="الاسم الكامل"
          value={fullName}
          onChange={setFullName}
          placeholder="مثال: أحمد محمد"
          icon={User}
          required
        />

        <AuthTextField
          id="whatsapp"
          label="رقم واتساب"
          value={whatsapp}
          onChange={setWhatsapp}
          placeholder="07XXXXXXXXX"
          icon={Phone}
          dir="ltr"
          required
        />

        <p className="text-xs text-muted-foreground font-arabic leading-relaxed">
          <MessageCircle className="inline w-3.5 h-3.5 ml-1" />
          لا نعرض الأسعار علناً — سيتم إرسال تفاصيل الباقات بعد التواصل معك.
        </p>

        <Button type="submit" disabled={loading} className={authSubmitClass}>
          {loading ? 'جاري الإرسال...' : 'طلب الوصول'}
        </Button>

        <p className="text-center text-sm text-muted-foreground font-arabic">
          لديك حساب بالفعل؟{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            تسجيل الدخول
          </Link>
        </p>
      </form>
    </AuthPageShell>
  );
};

export default RequestAccess;
