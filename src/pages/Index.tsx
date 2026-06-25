import LandingNav from '@/components/landing/LandingNav';
import LandingHero from '@/components/landing/LandingHero';
import LandingFeatures from '@/components/landing/LandingFeatures';
import LandingDashboardPreview from '@/components/landing/LandingDashboardPreview';
import LandingBenefits from '@/components/landing/LandingBenefits';
import LandingTestimonials from '@/components/landing/LandingTestimonials';
import LandingPricing from '@/components/landing/LandingPricing';
import LandingFAQ from '@/components/landing/LandingFAQ';
import LandingFinalCTA from '@/components/landing/LandingFinalCTA';
import LandingFooter from '@/components/landing/LandingFooter';

const Index = () => (
  <div className="landing-page min-h-screen font-arabic" dir="rtl">
    <LandingNav />
    <main>
      <LandingHero />
      <LandingFeatures />
       
      <LandingDashboardPreview />
      <LandingBenefits />
      <LandingTestimonials />
      <LandingPricing />
      <LandingFAQ />
      <LandingFinalCTA />
    </main>
    <LandingFooter />
  </div>
);

export default Index;
