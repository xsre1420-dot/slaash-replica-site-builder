import { Link } from 'react-router-dom';
import { MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { buildWhatsAppUrl } from '@/types/leads';

const SUPPORT_WHATSAPP = import.meta.env.VITE_SALES_WHATSAPP || '9647700000000';

const SubscriptionExpired = () => {
  const waUrl = buildWhatsAppUrl(
    SUPPORT_WHATSAPP,
    'مرحباً، أريد تجديد اشتراكي في منصة بداية'
  );

  return (
    <AuthPageShell>
      <div className="text-center space-y-6 py-6 font-arabic" dir="rtl">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
          <Phone className="w-8 h-8 text-amber-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">انتهى اشتراكك</h1>
          <p className="text-muted-foreground leading-relaxed max-w-md mx-auto">
            للاستمرار في استخدام لوحة التحكم وإدارة متجرك، يرجى التواصل مع فريق المبيعات
            لتجديد الاشتراك أو ترقية الباقة.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href={waUrl} target="_blank" rel="noopener noreferrer">
            <Button className="rounded-xl gap-2 w-full sm:w-auto bg-[#25D366] hover:bg-[#20bd5a] text-white">
              <MessageCircle className="w-4 h-4" />
              تواصل عبر واتساب
            </Button>
          </a>
          <Link to="/login">
            <Button variant="outline" className="rounded-xl w-full sm:w-auto">
              تسجيل الدخول بحساب آخر
            </Button>
          </Link>
        </div>
      </div>
    </AuthPageShell>
  );
};

export default SubscriptionExpired;
