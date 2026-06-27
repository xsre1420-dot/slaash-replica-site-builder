import ElitePricingCard from '@/components/landing/ElitePricingCard';
import { FadeUp, SectionTitle } from '@/components/landing/FadeUp';
import { landingPricing } from '@/content/landingCopy';

const LandingPricing = () => (
  <section id="pricing" className="landing-section landing-section--muted">
    <div className="container mx-auto px-4 sm:px-6">
      <FadeUp>
        <SectionTitle
          align="right"
          eyebrow={landingPricing.eyebrow}
          title={
            <>
              {landingPricing.title}{' '}
              <span className="text-primary">{landingPricing.titleAccent}</span>
            </>
          }
          subtitle={landingPricing.subtitle}
        />
      </FadeUp>

      <FadeUp delay={0.06}>
        <div className="mx-auto mt-10 max-w-lg">
          <ElitePricingCard />
        </div>
      </FadeUp>
    </div>
  </section>
);

export default LandingPricing;
