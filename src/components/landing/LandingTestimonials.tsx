import { FadeUp, SectionTitle } from '@/components/landing/FadeUp';
import { landingTestimonials } from '@/content/landingCopy';

const LandingTestimonials = () => (
  <section className="landing-section landing-section--muted">
    <div className="container mx-auto px-4">
      <FadeUp>
        <SectionTitle
          eyebrow={landingTestimonials.eyebrow}
          title={
            <>
              {landingTestimonials.title}{' '}
              <span className="text-primary">{landingTestimonials.titleAccent}</span>
            </>
          }
          subtitle={landingTestimonials.subtitle}
        />
      </FadeUp>

      <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
        {landingTestimonials.items.map((item, i) => (
          <FadeUp key={item.name} delay={i * 0.08}>
            <blockquote className="landing-card flex h-full flex-col p-6 sm:p-7">
              <p className="flex-1 text-sm leading-relaxed text-[#334155] sm:text-base">&ldquo;{item.quote}&rdquo;</p>
              <footer className="mt-5 flex items-center gap-3 border-t border-[#f1f5f9] pt-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {item.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111827]">{item.name}</p>
                  <p className="text-xs text-[#64748b]">{item.role}</p>
                </div>
              </footer>
            </blockquote>
          </FadeUp>
        ))}
      </div>
    </div>
  </section>
);

export default LandingTestimonials;
