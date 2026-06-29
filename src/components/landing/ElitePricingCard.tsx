import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ELITE_PLAN_BADGE,
  ELITE_PLAN_NAME,
  PUBLIC_SUBSCRIPTION_PLANS,
  formatPlanPriceHero,
  getPlanIndex,
  type PublicSubscriptionPlan,
} from '@/data/subscriptionPlans';

type ElitePricingCardProps = {
  onSelect?: (planId: string) => void;
  selectedPlanId?: string | null;
  defaultPlanId?: string;
  showCta?: boolean;
};

const flipVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    rotateY: direction * 72,
    x: direction * 24,
    scale: 0.97,
  }),
  center: {
    opacity: 1,
    rotateY: 0,
    x: 0,
    scale: 1,
  },
  exit: (direction: number) => ({
    opacity: 0,
    rotateY: direction * -72,
    x: direction * -24,
    scale: 0.97,
  }),
};

const ElitePricingCard = ({
  onSelect,
  selectedPlanId,
  defaultPlanId = 'annual',
  showCta = true,
}: ElitePricingCardProps) => {
  const [activeId, setActiveId] = useState(
    PUBLIC_SUBSCRIPTION_PLANS.find((p) => p.id === (selectedPlanId || defaultPlanId))?.id ?? 'annual'
  );
  const [direction, setDirection] = useState(0);
  const prevIndexRef = useRef(getPlanIndex(activeId));

  useEffect(() => {
    const next = selectedPlanId || defaultPlanId;
    if (next && PUBLIC_SUBSCRIPTION_PLANS.some((p) => p.id === next)) {
      const nextIndex = getPlanIndex(next);
      if (nextIndex >= 0 && nextIndex !== prevIndexRef.current) {
        setDirection(nextIndex > prevIndexRef.current ? 1 : -1);
        prevIndexRef.current = nextIndex;
      }
      setActiveId(next);
    }
  }, [selectedPlanId, defaultPlanId]);

  const activePlan =
    PUBLIC_SUBSCRIPTION_PLANS.find((p) => p.id === activeId) ?? PUBLIC_SUBSCRIPTION_PLANS[0];
  const { main, suffix } = formatPlanPriceHero(activePlan);
  const isSelected = selectedPlanId === activePlan.id;
  const activeIndex = getPlanIndex(activeId);

  const handlePeriodChange = (plan: PublicSubscriptionPlan) => {
    if (plan.id === activeId) return;
    const nextIndex = getPlanIndex(plan.id);
    setDirection(nextIndex > activeIndex ? 1 : -1);
    prevIndexRef.current = nextIndex;
    setActiveId(plan.id);
  };

  return (
    <div className="mx-auto w-full max-w-md text-right" dir="rtl">
      {/* Toggle */}
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-xl border border-border bg-neutral-100/80 p-1 dark:bg-neutral-900/40">
          {PUBLIC_SUBSCRIPTION_PLANS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => handlePeriodChange(plan)}
              className={cn(
                'relative min-w-[108px] rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-200',
                activeId === plan.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {activeId === plan.id && (
                <motion.span
                  layoutId="elite-billing-pill"
                  className="absolute inset-0 rounded-lg border border-border bg-card shadow-soft"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative flex flex-col items-center gap-0.5">
                {plan.toggleLabel}
                {plan.highlight && (
                  <span
                    className={cn(
                      'text-[10px] font-medium leading-none',
                      activeId === plan.id ? 'text-foreground/70' : 'text-muted-foreground/60'
                    )}
                  >
                    {plan.highlight}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Card */}
      <div
        className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
        style={{ perspective: 1400 }}
      >
        <div className="border-b border-border bg-neutral-50 px-6 py-3 text-center dark:bg-neutral-900/50">
          <span className="text-xs font-semibold tracking-wide text-foreground/80">{ELITE_PLAN_BADGE}</span>
        </div>

        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={activePlan.id}
              custom={direction}
              variants={flipVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                duration: 0.42,
                ease: [0.32, 0.72, 0, 1],
              }}
              className="px-6 pt-8 sm:px-8"
              style={{
                transformStyle: 'preserve-3d',
                backfaceVisibility: 'hidden',
              }}
            >
              {/* Header */}
              <div className="mb-6 flex items-start gap-3">
                <div className="min-w-0 flex-1 text-right">
                  <p className="text-xs font-medium text-muted-foreground">اشتراك {activePlan.toggleLabel}</p>
                  <h3 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {ELITE_PLAN_NAME}
                  </h3>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-neutral-100 dark:bg-neutral-800">
                  <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
                </div>
              </div>

              {/* Price */}
              <div className="mb-3 text-right">
                <p className="leading-none text-foreground">
                  <span className="text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl">
                    {main}
                  </span>
                  <span className="text-base font-medium text-muted-foreground sm:text-lg">{suffix}</span>
                </p>
              </div>

              {activePlan.highlight && (
                <p className="mb-4 inline-block rounded-lg border border-border bg-neutral-50 px-3 py-1.5 text-xs font-medium text-foreground/80 dark:bg-neutral-900/50">
                  {activePlan.highlight} مقارنةً بفترتين × 6 أشهر
                </p>
              )}

              <p className="mb-7 text-sm leading-relaxed text-muted-foreground">{activePlan.description}</p>

              {/* Features */}
              <div className="rounded-xl border border-border bg-neutral-50/80 p-4 dark:bg-neutral-900/30">
                <p className="mb-3 text-xs font-semibold text-muted-foreground">ما الذي تحصل عليه؟</p>
                <ul className="space-y-2.5">
                  {activePlan.features.map((feature, i) => (
                    <motion.li
                      key={feature}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.03 * i, duration: 0.25 }}
                      className="flex items-start gap-2.5 text-sm"
                    >
                      <span className="min-w-0 flex-1 text-right leading-relaxed text-foreground/90">
                        {feature}
                      </span>
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                        <Check className="h-3 w-3 text-foreground/70" strokeWidth={2.5} />
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </AnimatePresence>

          {showCta && (
            <div className="px-6 pb-8 pt-6 sm:px-8">
              {onSelect ? (
                <Button
                  type="button"
                  size="lg"
                  variant="default"
                  className="group h-12 w-full rounded-xl bg-foreground text-background font-semibold hover:bg-foreground/90"
                  onClick={() => onSelect(activePlan.id)}
                >
                  {isSelected ? 'متابعة — أكمل بياناتك' : 'ابدأ الآن'}
                  <ArrowLeft className="mr-1 h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                </Button>
              ) : (
                <Link to={`/request-access?plan=${activePlan.id}`}>
                  <Button
                    size="lg"
                    className="group h-12 w-full rounded-xl bg-foreground text-background font-semibold hover:bg-foreground/90"
                  >
                    ابدأ الآن
                    <ArrowLeft className="mr-1 h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        الأسعار بالدينار العراقي — التفعيل عبر فريق المبيعات
      </p>
    </div>
  );
};

export default ElitePricingCard;
