import ElitePricingCard from '@/components/landing/ElitePricingCard';
import { FadeUp, SectionTitle } from '@/components/landing/FadeUp';

const LandingPricing = () => (
  <section id="pricing" className="landing-section landing-section--muted">
    <div className="container mx-auto px-4 sm:px-6">
      <FadeUp>
        <SectionTitle
          align="right"
          eyebrow="باقات الاشتراك"
          title="باقة النخبة — كل ما يحتاجه متجرك"
          subtitle="اختر مدّة الاشتراك — 6 أشهر أو سنة — ثم أرسل بياناتك ونتواصل معك عبر واتساب."
        />
      </FadeUp>

      <FadeUp delay={0.08}>
        <div className="mx-auto mt-12 max-w-lg">
          <ElitePricingCard />
        </div>
      </FadeUp>
    </div>
  </section>
);

export default LandingPricing;
