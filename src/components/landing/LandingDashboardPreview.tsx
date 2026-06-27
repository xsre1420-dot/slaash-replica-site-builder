import { FadeUp, SectionTitle } from '@/components/landing/FadeUp';
import DashboardMockup from '@/components/landing/DashboardMockup';
import { CheckCircle2 } from 'lucide-react';
import { landingDemo } from '@/content/landingCopy';

const LandingDashboardPreview = () => (
  <section id="demo" className="landing-section landing-section--muted">
    <div className="container mx-auto px-4">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <FadeUp>
          <SectionTitle
            align="right"
            eyebrow={landingDemo.eyebrow}
            title={
              <>
                {landingDemo.title}{' '}
                <span className="text-primary">{landingDemo.titleAccent}</span>
              </>
            }
            subtitle={landingDemo.subtitle}
          />
          <ul className="mt-6 space-y-2.5">
            {landingDemo.highlights.map((item) => (
              <li key={item} className="flex items-center gap-3 text-[#475569]">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} />
                <span className="text-sm font-medium sm:text-base">{item}</span>
              </li>
            ))}
          </ul>
        </FadeUp>

        <FadeUp delay={0.1}>
          <DashboardMockup className="lg:scale-[1.02]" />
        </FadeUp>
      </div>
    </div>
  </section>
);

export default LandingDashboardPreview;
