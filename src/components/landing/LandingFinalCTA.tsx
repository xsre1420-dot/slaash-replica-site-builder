import { ArrowLeft, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FadeUp } from '@/components/landing/FadeUp';
import { landingCta } from '@/content/landingCopy';

const LandingFinalCTA = () => (
  <section id="contact" className="landing-section pb-16 sm:pb-20">
    <div className="container mx-auto px-4">
      <FadeUp>
        <div className="landing-card mx-auto max-w-3xl overflow-hidden p-8 text-center sm:p-12">
          <p className="mb-3 text-sm font-semibold text-primary">{landingCta.eyebrow}</p>
          <h2 className="landing-section-title mb-4">
            {landingCta.title}{' '}
            <span className="text-primary">{landingCta.titleAccent}</span>
          </h2>
          <p className="mx-auto mb-7 max-w-lg text-base leading-relaxed text-[#64748b]">
            {landingCta.subtitle}
          </p>

          <Link to="/request-access">
            <Button size="lg" className="min-w-[220px] rounded-full px-10 font-semibold group">
              {landingCta.button}
              <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            </Button>
          </Link>

          <p className="mt-3 text-xs text-[#94a3b8]">{landingCta.note}</p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {landingCta.perks.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#f8fafc] px-3 py-1.5 text-xs font-medium text-[#64748b]"
              >
                <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
                {item}
              </span>
            ))}
          </div>

          <p className="mt-6 text-sm text-[#64748b]">
            {landingCta.loginPrompt}{' '}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              {landingCta.loginLink}
            </Link>
          </p>
        </div>
      </FadeUp>
    </div>
  </section>
);

export default LandingFinalCTA;
