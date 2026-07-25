import { useId } from 'react';
import { Sparkles, Users, ClipboardList, Store, Smile } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { landingFeatures, type FeatureItem } from '@/components/landing/FeaturesSection';

const motionEase = [0.22, 1, 0.36, 1] as const;
const ICON_STROKE = 1.5;

const roadmapStats = [
  { icon: Smile, value: '98%', label: 'رضا المستخدمين', tone: 'lp-roadmap-stat-icon--0' },
  { icon: Store, value: '35+', label: 'متجر نشط', tone: 'lp-roadmap-stat-icon--1' },
  { icon: ClipboardList, value: '1,200+', label: 'طلب مُعالج', tone: 'lp-roadmap-stat-icon--2' },
  { icon: Users, value: '150+', label: 'عميل', tone: 'lp-roadmap-stat-icon--3' },
];

const roadmapStars = [
  { top: '6%', right: '14%', size: 7, opacity: 0.45 },
  { top: '22%', left: '9%', size: 9, opacity: 0.5 },
  { top: '44%', right: '7%', size: 6, opacity: 0.35 },
  { top: '68%', left: '11%', size: 8, opacity: 0.4 },
];

/** Smooth S-wave through center — one node per feature */
const ROADMAP_WAVE_PATH =
  'M 50 35 C 82 62, 82 88, 50 115 C 18 142, 18 168, 50 195 C 82 222, 82 248, 50 275 C 18 302, 18 328, 50 355 C 82 382, 82 408, 50 435 C 18 462, 18 488, 50 515 C 82 542, 82 568, 50 595';

const FourPointStar = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 2L13.8 10.2L22 12L13.8 13.8L12 22L10.2 13.8L2 12L10.2 10.2L12 2Z"
      fill="currentColor"
    />
  </svg>
);

type RoadmapFeatureCardProps = {
  feature: FeatureItem;
  step: string;
  side: 'right' | 'left';
  index: number;
  reducedMotion: boolean;
};

const RoadmapFeatureCard = ({
  feature,
  step,
  side,
  index,
  reducedMotion,
}: RoadmapFeatureCardProps) => {
  const Icon = feature.icon;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24, x: side === 'right' ? 12 : -12 }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: '-48px' }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: motionEase }}
      whileHover={reducedMotion ? undefined : { y: -5 }}
      className={cn(
        'lp-roadmap-card group',
        side === 'right' ? 'lp-roadmap-card--right' : 'lp-roadmap-card--left'
      )}
    >
      <span className="lp-roadmap-card-step">{step}</span>

      <div className={cn('lp-roadmap-card-icon', feature.iconTone)}>
        <Icon className={cn('h-[1.35rem] w-[1.35rem]', feature.iconColor)} strokeWidth={ICON_STROKE} />
      </div>

      <span className="lp-roadmap-card-tag">{feature.tag}</span>
      <h3 className="lp-roadmap-card-title">{feature.title}</h3>
      <p className="lp-roadmap-card-desc">{feature.desc}</p>
    </motion.article>
  );
};

type RoadmapWaveProps = {
  reducedMotion: boolean;
};

const RoadmapWave = ({ reducedMotion }: RoadmapWaveProps) => {
  const uid = useId();
  const gradientId = `lp-wave-grad${uid}`;
  const glowId = `lp-wave-glow${uid}`;

  return (
    <svg
      className="lp-roadmap-wave pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 630"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="50" y1="0" x2="50" y2="630" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(var(--primary))" stopOpacity="0.12" />
          <stop offset="0.45" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
          <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.12" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-10%" width="200%" height="120%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Mobile + reduced-motion: always-visible static line */}
      <path
        className="lp-roadmap-wave-line md:hidden"
        d={ROADMAP_WAVE_PATH}
        stroke={`url(#${gradientId})`}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Desktop: animated draw */}
      {!reducedMotion ? (
        <motion.path
          className="lp-roadmap-wave-line hidden md:block"
          d={ROADMAP_WAVE_PATH}
          stroke={`url(#${gradientId})`}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={`url(#${glowId})`}
          initial={{ pathLength: 0, opacity: 0.35 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 1.6, ease: motionEase }}
        />
      ) : (
        <path
          className="lp-roadmap-wave-line hidden md:block"
          d={ROADMAP_WAVE_PATH}
          stroke={`url(#${gradientId})`}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={`url(#${glowId})`}
        />
      )}
    </svg>
  );
};

const FeaturesRoadmapSection = () => {
  const reducedMotion = useReducedMotion();

  return (
    <section
      id="features"
      className="lp-roadmap-section relative overflow-x-clip"
      aria-labelledby="features-roadmap-title"
    >
      <div className="lp-roadmap-bg" aria-hidden />
      <div className="lp-roadmap-bg-glow" aria-hidden />
      <div className="pointer-events-none absolute inset-0 lp-grid-subtle opacity-30" aria-hidden />

      {roadmapStars.map((star, i) => (
        <span
          key={i}
          className="lp-roadmap-star pointer-events-none absolute text-primary/35"
          style={{
            top: star.top,
            left: star.left,
            right: star.right,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
          }}
        >
          <FourPointStar size={star.size} />
        </span>
      ))}

      <div className="container relative z-10 mx-auto px-4 py-16 sm:py-20 lg:py-24">
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: motionEase }}
          className="lp-roadmap-hero mx-auto mb-14 max-w-3xl text-center sm:mb-16 lg:mb-20"
        >
          <span className="lp-roadmap-badge">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            لماذا بداية؟
          </span>

          <h2 id="features-roadmap-title" className="lp-roadmap-title">
            كل ما تحتاجه{' '}
            <span className="lp-roadmap-title-gradient">لتنمية متجرك</span>
          </h2>

          <p className="lp-roadmap-subtitle">
            من إدارة المنتجات إلى تتبع المبيعات — أدوات عملية مصمّمة لتجّار التجزئة الذين يريدون
            النمو بسرعة دون تعقيد.
          </p>
        </motion.header>

        <div className="lp-roadmap-track relative mx-auto max-w-5xl">
          <RoadmapWave reducedMotion={!!reducedMotion} />

          <div className="lp-roadmap-steps">
            {landingFeatures.map((feature, index) => {
              const step = String(index + 1).padStart(2, '0');
              const side = index % 2 === 0 ? 'right' : 'left';

              return (
                <div
                  key={feature.title}
                  className={cn(
                    'lp-roadmap-row',
                    side === 'right' ? 'lp-roadmap-row--right' : 'lp-roadmap-row--left'
                  )}
                >
                  <div className="lp-roadmap-node-wrap">
                    <motion.span
                      className="lp-roadmap-node"
                      initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.35, delay: 0.15 + index * 0.08, ease: motionEase }}
                    >
                      <span className="lp-roadmap-node-ring" aria-hidden />
                      <span className="lp-roadmap-node-core" />
                    </motion.span>
                  </div>

                  <div className="lp-roadmap-card-wrap">
                    <RoadmapFeatureCard
                      feature={feature}
                      step={step}
                      side={side}
                      index={index}
                      reducedMotion={!!reducedMotion}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1, ease: motionEase }}
          className="lp-roadmap-stats mx-auto mt-14 max-w-4xl sm:mt-16 lg:mt-20"
        >
          {roadmapStats.map(({ icon: Icon, value, label, tone }, i) => (
            <div key={label} className="lp-roadmap-stat">
              {i > 0 && <span className="lp-roadmap-stat-divider hidden sm:block" aria-hidden />}
              <span className={cn('lp-roadmap-stat-icon', tone)}>
                <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={ICON_STROKE} />
              </span>
              <div className="lp-roadmap-stat-copy">
                <span className="lp-roadmap-stat-value">{value}</span>
                <span className="lp-roadmap-stat-label">{label}</span>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesRoadmapSection;
