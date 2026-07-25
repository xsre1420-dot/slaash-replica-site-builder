import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Gift,
  Package,
  Smile,
  Sparkles,
  Store,
  Users,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import HeroVisualDecor from '@/components/landing/HeroVisualDecor';
import HeroFeatureFlow from '@/components/landing/HeroFeatureFlow';

/** Platform metrics shown in the floating stats bar (RTL order: right → left). */
const stats = [
  { icon: Smile, value: '99%', label: 'رضا المستخدمين' },
  { icon: Store, value: '150+', label: 'متجر نشط' },
  { icon: Package, value: '5,000+', label: 'منتج مضاف' },
  { icon: Users, value: '1,000+', label: 'عميل سعيد' },
];

const trustItems = [
  { icon: CreditCard, label: 'بدون بطاقة ائتمان' },
  { icon: Zap, label: 'إعداد سريع' },
  { icon: Gift, label: 'تجربة مجانية' },
];

const ease = [0.22, 1, 0.36, 1] as const;

const statsBarContent = (
  <div className="lp-hero-stats-wrap">
    <div className="lp-hero-stats-bar">
      {stats.map(({ icon: Icon, value, label }, i) => (
        <div key={label} className="lp-hero-stat">
          {i > 0 && <span className="lp-hero-stat-divider hidden sm:block" aria-hidden />}
          <span className="lp-hero-stat-icon-wrap">
            <Icon className="lp-hero-stat-icon" strokeWidth={1.75} />
          </span>
          <div className="lp-hero-stat-copy">
            <span className="lp-hero-stat-value">{value}</span>
            <span className="lp-hero-stat-label">{label}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const LandingHeroSection = () => {
  const reducedMotion = useReducedMotion();

  return (
    <section className="lp-hero relative overflow-visible">
      <div className="pointer-events-none absolute inset-0 lp-hero-bg" aria-hidden />

      <div className="container relative z-10 mx-auto px-4 pb-5 pt-2 sm:pb-10 sm:pt-4 lg:pb-12 lg:pt-5">
        <div className="mx-auto max-w-[52rem] text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease }}
            className="mb-2 flex justify-center sm:mb-4"
          >
            <span className="lp-hero-eyebrow">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              منصة متكاملة للتجارة الإلكترونية
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.06, ease }}
            className="lp-hero-title mx-auto max-w-[46rem]"
          >
            <span className="block text-primary">ابدأ متجرك الإلكتروني</span>
            <span className="lp-hero-title-accent mt-1 block text-foreground sm:mt-1.5">
              في دقائق، وركّز على{' '}
              <span className="relative inline-block text-primary">
                مبيعاتك
                <svg
                  className="pointer-events-none absolute -bottom-0.5 left-0 right-0 mx-auto h-2 w-full max-w-[4.5rem] text-primary/55"
                  viewBox="0 0 120 8"
                  fill="none"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d="M2 6C28 2 52 2 78 4.5C92 6 108 5 118 3"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              .
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.14, ease }}
            className="lp-hero-subtitle mx-auto mt-2.5 max-w-[42rem] sm:mt-4"
          >
            منصة متكاملة تساعدك على إنشاء متجرك بسهولة، إدارة منتجاتك، استقبال الطلبات، ومتابعة
            مبيعاتك من لوحة تحكم واحدة.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.22, ease }}
            className="mt-4 flex flex-col items-center justify-center gap-2.5 sm:mt-6 sm:flex-row sm:gap-3.5"
            dir="rtl"
          >
            <Link to="/request-access" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="lp-hero-btn-primary group h-[3.25rem] w-full min-w-[13.5rem] rounded-full px-7 text-[0.9375rem] font-semibold sm:w-auto"
              >
                ابدأ الآن مجانًا
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" strokeWidth={2.25} />
              </Button>
            </Link>
            <a href="#pricing" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="lp-hero-btn-secondary group h-[3.25rem] w-full min-w-[13.5rem] rounded-full border-border/50 bg-card px-7 text-[0.9375rem] font-semibold text-foreground shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:w-auto"
              >
                عرض الباقات
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
              </Button>
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.28, ease }}
            className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 sm:mt-5 sm:gap-x-6"
            dir="rtl"
          >
            {trustItems.map(({ icon: Icon, label }, i) => (
              <span key={label} className="lp-hero-trust-item">
                {i > 0 && <span className="lp-hero-trust-divider hidden sm:inline" aria-hidden />}
                <Icon className="h-3.5 w-3.5 text-primary/80" strokeWidth={2} />
                {label}
              </span>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.32, ease }}
          className="lp-hero-visual relative mx-auto mt-3 max-w-[76rem] sm:mt-7 lg:mt-9"
        >
          <HeroVisualDecor animate={!reducedMotion} />

          <div className="lp-hero-visual-stack">
            <HeroFeatureFlow animate={!reducedMotion} statsBar={statsBarContent} />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default LandingHeroSection;
