import { ClipboardList, Package, Store, Zap, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { FadeUp } from '@/components/landing/FadeUp';
import LandingSectionHeader from '@/components/landing/LandingSectionHeader';

const steps: {
  step: string;
  title: string;
  icon: LucideIcon;
}[] = [
  { step: '01', title: 'إنشاء متجرك', icon: Store },
  { step: '02', title: 'أضف منتجاتك', icon: Package },
  { step: '03', title: 'استقبل طلباتك', icon: ClipboardList },
];

const stepEase = [0.22, 1, 0.36, 1] as const;

const StepCard = ({
  step,
  index,
  reducedMotion,
}: {
  step: (typeof steps)[number];
  index: number;
  reducedMotion: boolean;
}) => {
  const Icon = step.icon;

  return (
    <FadeUp delay={index * 0.1} className="relative h-full">
      <motion.article
        className="lp-step group relative h-full text-center"
        whileHover={reducedMotion ? undefined : { y: -4 }}
        transition={{ duration: 0.25, ease: stepEase }}
      >
        {/* Mobile timeline node */}
        <span
          className="lp-step-timeline-dot md:hidden"
          aria-hidden
        />

        <div className="relative mx-auto mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center">
          <span
            className="pointer-events-none absolute inset-0 rounded-2xl bg-primary/[0.06] transition-all duration-300 group-hover:bg-primary/[0.1] group-hover:scale-105"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -inset-1 rounded-2xl opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100 bg-primary/15"
            aria-hidden
          />
          <motion.div
            className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-card shadow-sm ring-1 ring-border/40 transition-all duration-300 group-hover:ring-primary/25 group-hover:shadow-md group-hover:shadow-primary/[0.08]"
            whileHover={reducedMotion ? undefined : { scale: 1.06 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          >
            <Icon className="h-6 w-6 text-primary" strokeWidth={1.75} />
          </motion.div>
        </div>

        <span className="lp-step-index">{step.step}</span>
        <h3 className="text-base font-semibold text-foreground transition-colors duration-200 group-hover:text-primary sm:text-lg">
          {step.title}
        </h3>
      </motion.article>
    </FadeUp>
  );
};

const HowItWorksSection = () => {
  const reducedMotion = useReducedMotion();

  return (
    <section className="lp-section lp-section-muted relative overflow-hidden" aria-labelledby="how-it-works-title">
      <div className="pointer-events-none absolute inset-0 lp-grid-subtle" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-64 w-[min(100%,36rem)] -translate-x-1/2 rounded-full bg-primary/[0.04] blur-3xl"
        aria-hidden
      />

      <div className="container relative z-10 mx-auto px-4">
        <FadeUp>
          <LandingSectionHeader
            icon={Zap}
            eyebrow="كيف يعمل"
            title={
              <span id="how-it-works-title">ثلاث خطوات فقط</span>
            }
            subtitle="من الفكرة إلى متجر جاهز للبيع — بدون تعقيد"
            className="mb-14 sm:mb-16"
          />
        </FadeUp>

        <div className="relative mx-auto max-w-5xl">
          {/* Desktop connector — RTL gradient */}
          <motion.div
            className="lp-step-connector hidden md:block"
            initial={reducedMotion ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, delay: 0.2, ease: stepEase }}
            aria-hidden
          />

          {/* Mobile vertical timeline */}
          <div className="lp-step-timeline absolute top-8 bottom-8 right-[calc(50%-0.5px)] w-px md:hidden" aria-hidden />

          <div className="grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((step, i) => (
              <StepCard key={step.step} step={step} index={i} reducedMotion={!!reducedMotion} />
            ))}
          </div>
        </div>

        <FadeUp delay={0.35}>
          <p className="mx-auto mt-12 max-w-md text-center text-sm text-muted-foreground">
            جاهز للبدء؟{' '}
            <a
              href="#pricing"
              className="font-semibold text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
            >
              اختر باقتك الآن
            </a>
          </p>
        </FadeUp>
      </div>
    </section>
  );
};

export default HowItWorksSection;
