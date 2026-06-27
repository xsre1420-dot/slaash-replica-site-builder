import {
  BarChart3,
  LayoutDashboard,
  Megaphone,
  Package,
  ShoppingBag,
  Warehouse,
} from 'lucide-react';
import { FadeUp, SectionTitle } from '@/components/landing/FadeUp';
import { landingFeatures } from '@/content/landingCopy';

const icons = [LayoutDashboard, Package, ShoppingBag, Warehouse, Megaphone, BarChart3];

const LandingFeatures = () => (
  <section id="features" className="landing-section">
    <div className="container mx-auto px-4">
      <FadeUp>
        <SectionTitle
          eyebrow={landingFeatures.eyebrow}
          title={
            <>
              {landingFeatures.title}{' '}
              <span className="text-primary">{landingFeatures.titleAccent}</span>
            </>
          }
          subtitle={landingFeatures.subtitle}
        />
      </FadeUp>

      <div className="mx-auto mt-10 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {landingFeatures.items.map((feature, i) => {
          const Icon = icons[i];
          return (
            <FadeUp key={feature.title} delay={i * 0.05}>
              <article className="landing-card group h-full p-5 sm:p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="mb-2 text-base font-semibold text-[#111827] sm:text-lg">{feature.title}</h3>
                <p className="mb-3 text-sm leading-relaxed text-[#64748b]">{feature.desc}</p>
                <p className="text-xs font-semibold text-primary">{feature.result}</p>
              </article>
            </FadeUp>
          );
        })}
      </div>
    </div>
  </section>
);

export default LandingFeatures;
