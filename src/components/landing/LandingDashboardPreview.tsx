import { FadeUp, SectionTitle } from '@/components/landing/FadeUp';
import DashboardMockup from '@/components/landing/DashboardMockup';
import { CheckCircle2 } from 'lucide-react';

const highlights = [
  'مبيعات وطلبات لحظية',
  'تقارير أسبوعية وشهرية',
  'إدارة منتجات ومخزون',
  'واجهة متجر متجاوبة',
];

const LandingDashboardPreview = () => (
  <section id="demo" className="landing-section landing-section--muted">
    <div className="container mx-auto px-4">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <FadeUp>
          <SectionTitle
            align="right"
            eyebrow="لوحة التحكم"
            title={
              <>
                تحكّم كامل{' '}
                <span className="text-primary">من شاشة واحدة</span>
              </>
            }
            subtitle="لوحة تحليلات حديثة تعرض أداء متجرك — مبيعات، زيارات، وطلبات — بتصميم واضح وسريع."
          />
          <ul className="mt-8 space-y-3">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-3 text-[#475569]">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} />
                <span className="text-sm font-medium sm:text-base">{item}</span>
              </li>
            ))}
          </ul>
        </FadeUp>

        <FadeUp delay={0.12}>
          <DashboardMockup className="lg:scale-[1.02]" />
        </FadeUp>
      </div>
    </div>
  </section>
);

export default LandingDashboardPreview;
