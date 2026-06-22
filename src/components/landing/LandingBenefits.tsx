import { Clock, Code2, MousePointerClick, Smartphone, Zap } from 'lucide-react';
import { FadeUp, SectionTitle } from '@/components/landing/FadeUp';

const benefits = [
  {
    icon: MousePointerClick,
    title: 'سهل الاستخدام',
    desc: 'واجهة عربية بديهية — لا تحتاج خبرة تقنية.',
  },
  {
    icon: Code2,
    title: 'بدون برمجة',
    desc: 'أطلق متجرك دون كتابة سطر كود واحد.',
  },
  {
    icon: Clock,
    title: 'إعداد سريع',
    desc: 'من الطلب إلى التفعيل — خطوات واضحة وسريعة.',
  },
  {
    icon: Smartphone,
    title: 'متجاوب بالكامل',
    desc: 'متجرك ولوحتك تعملان بسلاسة على الجوال.',
  },
];

const steps = [
  { num: '01', title: 'اختر مدة اشتراكك', desc: '6 أشهر أو سنة — بسعر واضح' },
  { num: '02', title: 'أرسل بياناتك', desc: 'الاسم ورقم واتساب للتواصل' },
  { num: '03', title: 'ابدأ البيع', desc: 'نفعّل حسابك ومتجرك' },
];

const LandingBenefits = () => (
  <section className="landing-section">
    <div className="container mx-auto px-4">
      <FadeUp>
        <SectionTitle
          eyebrow="لماذا بداية؟"
          title="مصمّمة لتنمو معك"
          subtitle="منصة premium بمعايير SaaS عالمية — بسيطة للبداية، قوية للنمو."
        />
      </FadeUp>

      <div className="mx-auto mt-14 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {benefits.map((item, i) => {
          const Icon = item.icon;
          return (
            <FadeUp key={item.title} delay={i * 0.07}>
              <div className="landing-card h-full p-6 text-center">
                <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1f5f9] text-primary">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="mb-2 font-semibold text-[#111827]">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[#64748b]">{item.desc}</p>
              </div>
            </FadeUp>
          );
        })}
      </div>

      <FadeUp delay={0.1}>
        <div className="mx-auto mt-20 max-w-4xl">
          <div className="mb-10 flex items-center justify-center gap-2 text-primary">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-semibold">ثلاث خطوات للانطلاق</span>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.num} className="landing-card relative p-6 text-center">
                <span className="mb-3 inline-block text-xs font-bold tracking-widest text-primary/70">
                  {step.num}
                </span>
                <h3 className="mb-2 font-semibold text-[#111827]">{step.title}</h3>
                <p className="text-sm text-[#64748b]">{step.desc}</p>
                {i < steps.length - 1 && (
                  <div className="pointer-events-none absolute -left-3 top-1/2 hidden h-px w-6 bg-[#e2e8f0] md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </FadeUp>
    </div>
  </section>
);

export default LandingBenefits;
