import { ArrowLeft, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import DashboardMockup from '@/components/landing/DashboardMockup';
import { landingHero } from '@/content/landingCopy';

const LandingHero = () => (
  <section className="landing-hero relative overflow-hidden pt-6 pb-14 sm:pb-16 lg:pb-20">
    <div className="pointer-events-none absolute inset-0 landing-hero-grid" />

    <div className="container relative z-10 mx-auto px-4">
      <div className="mx-auto max-w-4xl text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-6 inline-flex items-center rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-sm font-medium text-primary"
        >
          {landingHero.badge}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="landing-display mb-5"
        >
          {landingHero.title}{' '}
          <span className="landing-highlight">{landingHero.titleHighlight}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16 }}
          className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-[#64748b] sm:text-lg"
        >
          {landingHero.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.24 }}
          className="flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link to="/request-access">
            <Button size="lg" className="min-w-[200px] rounded-full px-8 font-semibold group">
              {landingHero.ctaPrimary}
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
              {landingHero.ctaSecondary}
            </Button>
          </a>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto mt-12 max-w-5xl sm:mt-14"
      >
        <DashboardMockup />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45 }}
        className="mx-auto mt-12 max-w-3xl sm:mt-14"
      >
        <div className="grid grid-cols-3 gap-4 border-t border-[#e2e8f0] pt-8 sm:gap-8">
          {landingHero.stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-xl font-bold tabular-nums text-[#111827] sm:text-2xl">{stat.value}</p>
              <p className="mt-1 text-xs leading-snug text-[#64748b] sm:text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[11px] text-[#94a3b8]">{landingHero.statsNote}</p>
      </motion.div>
    </div>
  </section>
);

export default LandingHero;
