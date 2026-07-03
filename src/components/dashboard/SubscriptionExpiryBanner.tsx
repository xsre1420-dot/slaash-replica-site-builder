import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSubscription } from '@/context/SubscriptionContext';
import { getSubscriptionRemainingDays } from '@/utils/subscriptionPlanLabels';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const WARN_DAYS = 30;

const SubscriptionExpiryBanner = () => {
  const { subscription, isAdmin, hasAccess } = useSubscription();

  if (isAdmin || !hasAccess || !subscription?.end_date) return null;

  const daysLeft = getSubscriptionRemainingDays(subscription.end_date);
  if (daysLeft === null || daysLeft > WARN_DAYS) return null;

  const endLabel = format(new Date(subscription.end_date), 'dd MMM yyyy', { locale: ar });
  const urgent = daysLeft <= 7;

  return (
    <div
      className={
        urgent
          ? 'mx-4 mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm'
          : 'mx-4 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm'
      }
      dir="rtl"
    >
      <div className="flex flex-wrap items-start gap-2">
        <AlertTriangle
          className={`h-4 w-4 shrink-0 mt-0.5 ${urgent ? 'text-destructive' : 'text-amber-700'}`}
        />
        <div className="flex-1 min-w-0 space-y-1">
          <p className={`font-medium ${urgent ? 'text-destructive' : 'text-amber-900'}`}>
            {daysLeft <= 0
              ? 'انتهى اشتراكك'
              : daysLeft === 1
                ? 'ينتهي اشتراكك غداً'
                : `ينتهي اشتراكك خلال ${daysLeft} يوم`}
          </p>
          <p className="text-muted-foreground text-xs">
            تاريخ الانتهاء: {endLabel} — تواصل مع فريق المبيعات للتجديد.
          </p>
          {daysLeft <= 0 && (
            <Link to="/subscription-expired" className="text-xs text-primary hover:underline">
              إدخال رمز تجديد
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionExpiryBanner;
