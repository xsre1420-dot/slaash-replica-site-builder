import { Crown, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPlanPriceLabel, type PublicSubscriptionPlan } from '@/data/subscriptionPlans';

type SubscriptionPlanSummaryCardProps = {
  plan: PublicSubscriptionPlan;
  onChangePlan?: () => void;
  compact?: boolean;
};

const SubscriptionPlanSummaryCard = ({
  plan,
  onChangePlan,
  compact = false,
}: SubscriptionPlanSummaryCardProps) => (
  <div className={compact ? 'sub-summary sub-summary--compact' : 'sub-summary'}>
    <div className="sub-summary__glow" aria-hidden />
    <div className="sub-summary__inner">
      <div className="sub-summary__header">
        <div className="sub-summary__icon">
          <Crown className="h-5 w-5 text-amber-700" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="sub-summary__label">الباقة المختارة</p>
          <p className="sub-summary__title">
            {plan.name} — {plan.toggleLabel}
          </p>
          <p className="sub-summary__price">{formatPlanPriceLabel(plan)}</p>
        </div>
        {onChangePlan && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="sub-summary__change shrink-0"
            onClick={onChangePlan}
          >
            <Pencil className="h-3.5 w-3.5" />
            تغيير
          </Button>
        )}
      </div>

      {!compact && (
        <div className="sub-summary__meta">
          <div className="sub-summary__meta-item">
            <span className="sub-summary__meta-label">المدة</span>
            <span className="sub-summary__meta-value">{plan.billingLabel}</span>
          </div>
          {plan.highlight && (
            <div className="sub-summary__meta-item">
              <span className="sub-summary__meta-label">التوفير</span>
              <span className="sub-summary__meta-value text-emerald-700">{plan.highlight}</span>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);

export default SubscriptionPlanSummaryCard;
