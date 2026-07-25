import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Lock,
  Palette,
  Headphones,
  Smartphone,
  Sparkles,
  Megaphone,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { FadeUp } from '@/components/landing/FadeUp';
import LandingSectionHeader from '@/components/landing/LandingSectionHeader';
import { cn } from '@/lib/utils';

export type FeatureItem = {
  icon: LucideIcon;
  tag: string;
  title: string;
  desc: string;
  iconTone: string;
  iconColor: string;
  featured?: boolean;
};

export const landingFeatures: FeatureItem[] = [
  {
    icon: Megaphone,
    tag: 'Meta Pixel',
    title: 'إعلانات أذكى مع Meta Pixel',
    desc: 'اربط متجرك مع مدير إعلانات Meta ليحسّن استهداف إعلاناتك تلقائيًا ويصل إلى عملاء مشابهين لعملائك، لزيادة مبيعاتك.',
    iconTone: 'lp-feature-icon--primary',
    iconColor: 'text-primary',
    featured: true,
  },
  {
    icon: BarChart3,
    tag: 'تحليلات',
    title: 'لوحة تحكم لحظية',
    desc: 'شاهد مبيعاتك وزياراتك وأداء متجرك لحظة بلحظة من شاشة واحدة واضحة.',
    iconTone: 'lp-feature-icon--emerald',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    icon: Lock,
    tag: 'أمان',
    title: 'حماية لبياناتك وبيانات عملائك',
    desc: 'تشفير، صلاحيات، ونسخ احتياطي — ركّز على البيع واترك الأمان لنا.',
    iconTone: 'lp-feature-icon--violet',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
  {
    icon: Palette,
    tag: 'تصميم',
    title: 'صمّم متجرك بنفسك',
    desc: 'غيّر الألوان والشعار والصفحات بسهولة — بدون مطوّر ولا سطر كود.',
    iconTone: 'lp-feature-icon--amber',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    icon: Headphones,
    tag: 'دعم',
    title: 'دعم يرافقك خطوة بخطوة',
    desc: 'فريقنا جاهز عندما تحتاج مساعدة في الإعداد، التشغيل، أو حل أي عائق.',
    iconTone: 'lp-feature-icon--sky',
    iconColor: 'text-sky-600 dark:text-sky-400',
  },
  {
    icon: Smartphone,
    tag: 'جوال',
    title: 'تجربة مثالية على الهاتف',
    desc: 'متجرك يبدو احترافياً على الجوال والتابلت — لأن أغلب زبائنك يتصفحون من هناك.',
    iconTone: 'lp-feature-icon--rose',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
];

const motionEase = [0.22, 1, 0.36, 1] as const;

export const FeatureCard = ({
  feature,
  index,
  reducedMotion,
}: {
  feature: FeatureItem;
  index: number;
  reducedMotion: boolean;
}) => {
  const Icon = feature.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-48px' }}
      transition={{ duration: 0.42, delay: index * 0.05, ease: motionEase }}
      whileHover={reducedMotion ? undefined : { y: -3 }}
      className={feature.featured ? 'md:col-span-2 lg:col-span-2' : undefined}
    >
      <article
        className={cn(
          'lp-feature-card group',
          feature.featured && 'lp-feature-card--featured'
        )}
      >
        {feature.featured && (
          <span className="lp-feature-accent" aria-hidden />
        )}

        <div
          className={cn(
            'relative flex h-full items-start gap-4 text-right',
            feature.featured && 'flex-col sm:flex-row sm:gap-6'
          )}
        >
          <motion.div
            className={cn('lp-feature-icon shrink-0', feature.iconTone)}
            whileHover={reducedMotion ? undefined : { scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          >
            <Icon className={cn('h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]', feature.iconColor)} strokeWidth={1.75} />
          </motion.div>

          <div className="min-w-0 flex-1">
            <span className="lp-feature-tag">{feature.tag}</span>
            <h3 className="mb-2 text-base font-semibold leading-snug text-foreground transition-colors duration-200 group-hover:text-primary sm:text-lg">
              {feature.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
          </div>
        </div>
      </article>
    </motion.div>
  );
};

const FeaturesSection = () => {
  const reducedMotion = useReducedMotion();

  return (
    <section id="features" className="lp-section relative overflow-hidden bg-background" aria-labelledby="features-title">
      <div className="pointer-events-none absolute inset-0 lp-grid-subtle" aria-hidden />
      <div className="pointer-events-none absolute -right-24 top-1/4 h-72 w-72 rounded-full bg-primary/[0.04] blur-3xl" aria-hidden />

      <div className="container relative z-10 mx-auto px-4">
        <FadeUp>
          <LandingSectionHeader
            icon={Sparkles}
            eyebrow="لماذا بداية؟"
            title={
              <span id="features-title">
                كل ما تحتاجه <span className="text-primary">لتنمية متجرك</span>
              </span>
            }
            subtitle="من إدارة المنتجات إلى تتبع المبيعات — أدوات عملية مصمّمة لتجّار التجزئة الذين يريدون النمو بسرعة دون تعقيد."
            className="mb-12 sm:mb-14"
          />
        </FadeUp>

        <div className="mx-auto grid max-w-6xl gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {landingFeatures.map((feature, i) => (
            <FeatureCard
              key={feature.title}
              feature={feature}
              index={i}
              reducedMotion={!!reducedMotion}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
