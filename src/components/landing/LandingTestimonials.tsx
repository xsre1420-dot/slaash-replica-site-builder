import { FadeUp, SectionTitle } from '@/components/landing/FadeUp';

const testimonials = [
  {
    quote:
      'أطلقت متجري خلال يومين. لوحة التحكم واضحة والطلبات تصلني مباشرة — وفّرت عليّ وقت وجهد كبير.',
    name: 'سارة أحمد',
    role: 'متجر أزياء — بغداد',
    initials: 'س',
  },
  {
    quote:
      'كنت أدير المبيعات عبر واتساب فقط. الآن عندي متجر منظم، مخزون دقيق، وتقارير تساعدني أقرر.',
    name: 'محمد كريم',
    role: 'إلكترونيات — البصرة',
    initials: 'م',
  },
  {
    quote:
      'الدعم سريع والتفعيل كان سلس. أفضل قرار للانتقال من البيع اليدوي إلى متجر احترافي.',
    name: 'نور الهدى',
    role: 'مستحضرات — أربيل',
    initials: 'ن',
  },
];

const LandingTestimonials = () => (
  <section className="landing-section landing-section--muted">
    <div className="container mx-auto px-4">
      <FadeUp>
        <SectionTitle
          eyebrow="آراء التجار"
          title="يثقون بنا للنمو"
          subtitle="تجّار حقيقيون — نتائج حقيقية."
        />
      </FadeUp>

      <div className="mx-auto mt-14 grid max-w-6xl gap-6 md:grid-cols-3">
        {testimonials.map((item, i) => (
          <FadeUp key={item.name} delay={i * 0.08}>
            <blockquote className="landing-card flex h-full flex-col p-7">
              <p className="flex-1 text-base leading-relaxed text-[#334155]">&ldquo;{item.quote}&rdquo;</p>
              <footer className="mt-6 flex items-center gap-3 border-t border-[#f1f5f9] pt-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
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
