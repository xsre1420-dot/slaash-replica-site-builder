import { Check, Crown, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  ELITE_PLAN_NAME,
  PUBLIC_SUBSCRIPTION_PLANS,
  formatPlanPriceHero,
  type PublicSubscriptionPlan,
} from '@/data/subscriptionPlans';

type SubscriptionPlanPickerProps = {
  selectedPlanId: string | null;
  onSelect: (planId: string) => void;
};

const SubscriptionPlanPicker = ({ selectedPlanId, onSelect }: SubscriptionPlanPickerProps) => (
  <div className="sub-plan-picker">
    {PUBLIC_SUBSCRIPTION_PLANS.map((plan, index) => (
      <PlanOptionCard
        key={plan.id}
        plan={plan}
        selected={selectedPlanId === plan.id}
        recommended={plan.id === 'yearly'}
        index={index}
        onSelect={() => onSelect(plan.id)}
      />
    ))}
  </div>
);

type PlanOptionCardProps = {
  plan: PublicSubscriptionPlan;
  selected: boolean;
  recommended?: boolean;
  index: number;
  onSelect: () => void;
};

const PlanOptionCard = ({ plan, selected, recommended, index, onSelect }: PlanOptionCardProps) => {
  const { main, suffix } = formatPlanPriceHero(plan);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      onClick={onSelect}
      className={cn(
        'sub-plan-card group text-right',
        selected && 'sub-plan-card--selected',
        recommended && 'sub-plan-card--recommended'
      )}
    >
      {recommended && (
        <span className="sub-plan-card__badge">
          <Sparkles className="h-3 w-3" />
          الأكثر توفيراً
        </span>
      )}

      <div className="sub-plan-card__header">
        <div className="sub-plan-card__icon">
          <Crown className="h-5 w-5 text-amber-600" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="sub-plan-card__duration">{plan.toggleLabel}</p>
          <h3 className="sub-plan-card__name">{ELITE_PLAN_NAME}</h3>
        </div>
        <div
          className={cn(
            'sub-plan-card__check',
            selected ? 'sub-plan-card__check--on' : 'sub-plan-card__check--off'
          )}
        >
          {selected && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
        </div>
      </div>

      <div className="sub-plan-card__price">
        <span className="sub-plan-card__price-main">{main}</span>
        <span className="sub-plan-card__price-suffix">{suffix}</span>
      </div>

      {plan.highlight && (
        <p className="sub-plan-card__highlight">{plan.highlight}</p>
      )}

      <p className="sub-plan-card__desc">{plan.description}</p>

      <ul className="sub-plan-card__features">
        {plan.features.slice(0, 4).map((feature) => (
          <li key={feature} className="sub-plan-card__feature">
            <Check className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </motion.button>
  );
};

export default SubscriptionPlanPicker;
