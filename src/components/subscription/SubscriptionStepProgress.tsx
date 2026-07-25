import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SubscriptionStep = 'plan' | 'details';

const STEPS: { id: SubscriptionStep; label: string; number: number }[] = [
  { id: 'plan', label: 'اختر الباقة', number: 1 },
  { id: 'details', label: 'بياناتك', number: 2 },
];

type SubscriptionStepProgressProps = {
  current: SubscriptionStep;
};

const SubscriptionStepProgress = ({ current }: SubscriptionStepProgressProps) => {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <nav aria-label="خطوات الطلب" className="sub-step-progress">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isActive = index === currentIndex;

        return (
          <div key={step.id} className="sub-step-progress__item">
            {index > 0 && (
              <div
                className={cn(
                  'sub-step-progress__line',
                  isDone || isActive ? 'sub-step-progress__line--active' : ''
                )}
              />
            )}
            <div className="sub-step-progress__node">
              <div
                className={cn(
                  'sub-step-progress__dot',
                  isDone && 'sub-step-progress__dot--done',
                  isActive && 'sub-step-progress__dot--active'
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : step.number}
              </div>
              <span
                className={cn(
                  'sub-step-progress__label',
                  (isDone || isActive) && 'sub-step-progress__label--active'
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
};

export default SubscriptionStepProgress;
