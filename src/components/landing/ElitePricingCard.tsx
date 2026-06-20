import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Crown, Sparkles } from 'lucide-react';
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

const cardVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    rotateY: direction * 55,
    x: direction * 28,
    scale: 0.94,
    filter: 'blur(4px)',
  }),
  center: {
    opacity: 1,
    rotateY: 0,
    x: 0,
    scale: 1,
    filter: 'blur(0px)',
  },
  exit: (direction: number) => ({
    opacity: 0,
    rotateY: direction * -55,
    x: direction * -28,
    scale: 0.94,
    filter: 'blur(4px)',
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
    <div className="mx-auto w-full max-w-[420px]" style={{ perspective: 1200 }}>
      {/* Toggle */}
      <div className="mb-8 flex justify-center">
        <div className="relative inline-flex rounded-2xl bg-muted/60 p-1.5 ring-1 ring-border/50">
          {PUBLIC_SUBSCRIPTION_PLANS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => handlePeriodChange(plan)}
              className={cn(
                'relative z-10 min-w-[108px] rounded-xl px-5 py-2.5 text-sm font-bold transition-colors duration-200',
                activeId === plan.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
              )}
            >
              {activeId === plan.id && (
                <motion.span
                  layoutId="elite-billing-pill"
                  className="absolute inset-0 rounded-xl bg-card shadow-md ring-1 ring-border/40"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <span className="relative flex flex-col items-center gap-0.5">
                {plan.toggleLabel}
                {plan.highlight && (
                  <span
                    className={cn(
                      'text-[10px] font-semibold leading-none',
                      activeId === plan.id ? 'text-primary' : 'text-muted-foreground/70'
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

      {/* Card shell — fixed structure, animated inner content */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent p-[2px] shadow-xl shadow-primary/10">
        <div className="relative overflow-hidden rounded-[calc(1.5rem-2px)] bg-card">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/[0.07] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-amber-400/[0.08] blur-3xl" />

          <div className="absolute -top-px left-1/2 z-20 -translate-x-1/2">
            <div className="flex items-center gap-1.5 rounded-b-xl bg-primary px-5 py-2 text-xs font-bold tracking-wide text-primary-foreground shadow-lg">
              <Sparkles className="h-3.5 w-3.5" />
              {ELITE_PLAN_BADGE}
            </div>
          </div>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={activePlan.id}
              custom={direction}
              variants={cardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="px-6 pb-7 pt-12 sm:px-8 sm:pb-8 sm:pt-14"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Header */}
              <div className="mb-7 flex items-center justify-between gap-3">
                <div className="text-right">
                  <p className="text-xs font-medium text-muted-foreground">اشتراك {activePlan.toggleLabel}</p>
                  <h3 className="text-2xl font-bold tracking-tight text-foreground">{ELITE_PLAN_NAME}</h3>
                </div>
                <motion.div
                  initial={{ scale: 0.8, rotate: -12 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.08 }}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 shadow-md shadow-amber-500/25"
                >
                  <Crown className="h-6 w-6 text-amber-950" strokeWidth={2} />
                </motion.div>
              </div>

              {/* Price */}
              <div className="mb-2 text-right">
                <p className="leading-none text-foreground">
                  <span className="text-[2.75rem] font-extrabold tabular-nums tracking-tight sm:text-5xl">
                    {main}
                  </span>
                  <span className="text-base font-medium text-muted-foreground sm:text-lg">{suffix}</span>
                </p>
              </div>

              {activePlan.highlight && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                >
                  {activePlan.highlight} مقارنةً بفترتين × 6 أشهر
                </motion.p>
              )}

              <p className="mb-8 text-right text-sm leading-relaxed text-muted-foreground">
                {activePlan.description}
              </p>

              {/* Features */}
              <div className="mb-8 rounded-2xl border border-border/40 bg-muted/20 p-4">
                <p className="mb-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  ما الذي تحصل عليه؟
                </p>
                <ul className="space-y-2.5">
                  {activePlan.features.map((feature, i) => (
                    <motion.li
                      key={feature}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 * i, duration: 0.28 }}
                      className="flex items-center justify-end gap-2.5 text-right text-sm text-foreground/85"
                    >
                      <span>{feature}</span>
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Check className="h-3 w-3 text-primary" strokeWidth={3} />
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </div>

              {showCta &&
                (onSelect ? (
                  <Button
                    type="button"
                    size="lg"
                    className="group h-12 w-full rounded-xl text-base font-bold shadow-lg shadow-primary/25"
                    onClick={() => onSelect(activePlan.id)}
                  >
                    {isSelected ? 'متابعة — أكمل بياناتك' : 'ابدأ الآن'}
                    <ArrowLeft className="mr-1 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                  </Button>
                ) : (
                  <Link to={`/request-access?plan=${activePlan.id}`}>
                    <Button
                      size="lg"
                      className="group h-12 w-full rounded-xl text-base font-bold shadow-lg shadow-primary/25"
                    >
                      ابدأ الآن
                      <ArrowLeft className="mr-1 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                    </Button>
                  </Link>
                ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        الأسعار بالدينار العراقي — التفعيل عبر فريق المبيعات بعد إرسال طلبك
      </p>
    </div>
  );
};

export default ElitePricingCard;
