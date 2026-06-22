import { ArrowLeft, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import DashboardMockup from '@/components/landing/DashboardMockup';

const stats = [
  { value: '500+', label: 'متجر نشط' },
  { value: '50K+', label: 'طلب شهري' },
  { value: '99.9%', label: 'وقت تشغيل' },
];

const LandingHero = () => (
  <section className="landing-hero relative overflow-hidden pt-8 pb-16 sm:pb-20 lg:pb-24">
    <div className="pointer-events-none absolute inset-0 landing-hero-grid" />

    <div className="container relative z-10 mx-auto px-4">
      <div className="mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-sm font-medium text-primary"
        >
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">جديد</span>
          منصة متاجر عراقية — جاهزة للبيع من اليوم الأول
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="landing-display mb-6"
        >
          أنشئ متجرك الإلكتروني{' '}
          <span className="landing-highlight">باحترافية</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16 }}
          className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[#64748b] sm:text-xl"
        >
          منصة SaaS متكاملة لبناء وإدارة متجرك — منتجات، طلبات، مخزون، وتسويق من لوحة واحدة.
          بدون برمجة، بدون تعقيد.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.24 }}
          className="flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link to="/request-access">
            <Button size="lg" className="min-w-[200px] rounded-full px-8 font-semibold group">
              أنشئ متجرك
              <ArrowLeft className="mr-1.5 h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            </Button>
          </Link>
          <a href="#demo">
            <Button
              variant="outline"
              size="lg"
              className="min-w-[200px] rounded-full border-[#e2e8f0] bg-white px-8 font-semibold text-[#111827] hover:bg-[#f8fafc]"
            >
              <Play className="ml-2 h-4 w-4 fill-current" />
              شاهد العرض
            </Button>
          </a>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto mt-14 max-w-5xl sm:mt-16"
      >
        <DashboardMockup />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45 }}
        className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-6 border-t border-[#e2e8f0] pt-10 sm:gap-10"
      >
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-2xl font-bold tabular-nums text-[#111827] sm:text-3xl">{stat.value}</p>
            <p className="mt-1 text-sm text-[#64748b]">{stat.label}</p>
          </div>
        ))}
      </motion.div>
    </div>
  </section>
);

export default LandingHero;
