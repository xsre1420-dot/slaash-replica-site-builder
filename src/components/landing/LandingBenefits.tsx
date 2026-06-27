import { Clock, Headphones, Smartphone } from 'lucide-react';
import { FadeUp, SectionTitle } from '@/components/landing/FadeUp';
import { landingBenefits } from '@/content/landingCopy';

const icons = [Clock, Headphones, Smartphone];

const LandingBenefits = () => (
  <section className="landing-section">
    <div className="container mx-auto px-4">
      <FadeUp>
        <SectionTitle
          eyebrow={landingBenefits.eyebrow}
          title={
            <>
              {landingBenefits.title}{' '}
              <span className="text-primary">{landingBenefits.titleAccent}</span>
            </>
          }
          subtitle={landingBenefits.subtitle}
        />
      </FadeUp>

      <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
        {landingBenefits.items.map((item, i) => {
          const Icon = icons[i];
          return (
            <FadeUp key={item.title} delay={i * 0.06}>
              <div className="landing-card h-full p-5 text-center sm:p-6">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1f5f9] text-primary">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="mb-2 font-semibold text-[#111827]">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[#64748b]">{item.desc}</p>
              </div>
            </FadeUp>
          );
        })}
      </div>

      <FadeUp delay={0.08}>
        <div className="mx-auto mt-14 max-w-3xl">
          <p className="mb-6 text-center text-sm font-semibold text-primary">{landingBenefits.stepsEyebrow}</p>
          <div className="grid gap-4 md:grid-cols-3">
            {landingBenefits.steps.map((step) => (
              <div key={step.num} className="landing-card p-5 text-center">
                <span className="mb-2 inline-block text-xs font-bold tracking-widest text-primary/70">{step.num}</span>
                <h3 className="mb-1.5 font-semibold text-[#111827]">{step.title}</h3>
                <p className="text-sm text-[#64748b]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </FadeUp>
    </div>
  </section>
);

export default LandingBenefits;
