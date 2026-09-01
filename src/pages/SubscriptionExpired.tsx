import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { KeyRound, MessageCircle, LogOut, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useLandingPageBundle } from '@/hooks/useLandingPageBundle';
import { buildWhatsAppUrl } from '@/types/leads';
import { isSubscriptionExpired } from '@/utils/subscriptionExpiryUtils';

const SubscriptionExpired = () => {
  const navigate = useNavigate();
  const landing = useLandingPageBundle();
  const { user, logout, loading: authLoading } = useAuth();
  const { hasAccess, isAdmin, loading: subLoading, subscription, accessError } = useSubscription();

  useEffect(() => {
    if (authLoading || subLoading) return;
    if (user && (hasAccess || isAdmin)) {
      navigate(isAdmin ? '/admin/leads' : '/builder', { replace: true });
    }
  }, [user, hasAccess, isAdmin, authLoading, subLoading, navigate]);

  const waUrl = buildWhatsAppUrl(
    landing.salesWhatsApp,
    subscription?.end_date
      ? `مرحباً، انتهى اشتراكي في ${format(new Date(subscription.end_date), 'dd/MM/yyyy')} — أريد التجديد`
      : 'مرحباً، أريد تفعيل أو تجديد اشتراكي في منصة بداية'
  );

  const handleEnterCode = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const expiredByDate =
    subscription && isSubscriptionExpired(subscription) && subscription.end_date;

  return (
    <AuthPageShell>
      <div className="text-center space-y-6 py-6 font-arabic" dir="rtl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          {accessError === 'rpc_failed' ? (
            <WifiOff className="h-8 w-8 text-primary" />
          ) : (
            <KeyRound className="h-8 w-8 text-primary" />
          )}
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">
            {accessError === 'rpc_failed'
              ? 'تعذر التحقق من الاشتراك'
              : expiredByDate
                ? 'انتهى اشتراكك'
                : 'فعّل دخولك للمنصة'}
          </h1>
          <p className="mx-auto max-w-md leading-relaxed text-muted-foreground">
            {accessError === 'rpc_failed' ? (
              <>
                تحقق من اتصال الإنترنت ثم أعد تحميل الصفحة. إذا استمرت المشكلة، تواصل مع
                الدعم.
              </>
            ) : expiredByDate ? (
              <>
                انتهى اشتراكك في{' '}
                <span className="font-semibold text-foreground">
                  {format(new Date(subscription.end_date!), 'EEEE dd MMMM yyyy', { locale: ar })}
                </span>
                . أدخل رمز تجديد من فريق المبيعات أو تواصل للتمديد.
              </>
            ) : (
              <>
                أدخل <span className="font-semibold text-foreground">رمز التفعيل</span> الذي أرسله
                لك فريق المبيعات. الاشتراك يبدأ من تاريخ إنشاء الرمز — وليس من لحظة الدخول.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {accessError !== 'rpc_failed' && (
            <Button className="rounded-xl gap-2 w-full" size="lg" onClick={() => void handleEnterCode()}>
              <KeyRound className="h-4 w-4" />
              إدخال رمز التفعيل
            </Button>
          )}
          {accessError === 'rpc_failed' && (
            <Button className="rounded-xl w-full" size="lg" onClick={() => window.location.reload()}>
              إعادة المحاولة
            </Button>
          )}
          <a href={waUrl} target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              className="rounded-xl w-full gap-2 border-[#25D366]/30 text-[#128C7E] hover:bg-[#25D366]/5"
            >
              <MessageCircle className="h-4 w-4" />
              تواصل عبر واتساب للتجديد
            </Button>
          </a>
          <Link to="/request-access">
            <Button variant="ghost" className="rounded-xl w-full text-muted-foreground">
              اطلب اشتراكاً جديداً
            </Button>
          </Link>
          {user && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl gap-2 text-muted-foreground"
              onClick={() => void logout().then(() => navigate('/login'))}
            >
              <LogOut className="h-4 w-4" />
              خروج والدخول بحساب آخر
            </Button>
          )}
        </div>
      </div>
    </AuthPageShell>
  );
};

export default SubscriptionExpired;
