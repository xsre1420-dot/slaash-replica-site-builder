import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FadeUp, SectionTitle } from '@/components/landing/FadeUp';
import { landingFaq } from '@/content/landingCopy';

const LandingFAQ = () => (
  <section id="faq" className="landing-section">
    <div className="container mx-auto px-4">
      <FadeUp>
        <SectionTitle
          eyebrow={landingFaq.eyebrow}
          title={
            <>
              {landingFaq.title}{' '}
              <span className="text-primary">{landingFaq.titleAccent}</span>
            </>
          }
          subtitle={landingFaq.subtitle}
        />
      </FadeUp>

      <FadeUp delay={0.06}>
        <Accordion type="single" collapsible className="mx-auto mt-10 max-w-2xl space-y-2">
          {landingFaq.items.map((item, i) => (
            <AccordionItem
              key={item.q}
              value={`faq-${i}`}
              className="landing-card overflow-hidden border-0 px-1"
            >
              <AccordionTrigger className="px-5 py-3.5 text-right text-sm font-semibold text-[#111827] hover:no-underline sm:text-base [&[data-state=open]]:text-primary">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-4 text-sm leading-relaxed text-[#64748b]">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </FadeUp>
    </div>
  </section>
);

export default LandingFAQ;
