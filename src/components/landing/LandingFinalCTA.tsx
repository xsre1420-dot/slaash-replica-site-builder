import { ArrowLeft, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FadeUp } from '@/components/landing/FadeUp';

const perks = ['أسعار واضحة', 'رد سريع عبر واتساب', 'تفعيل من اليوم الأول'];

const LandingFinalCTA = () => (
  <section id="contact" className="landing-section pb-24 sm:pb-28">
    <div className="container mx-auto px-4">
      <FadeUp>
        <div className="landing-card mx-auto max-w-4xl overflow-hidden p-8 text-center sm:p-14">
          <p className="mb-4 text-sm font-semibold text-primary">جاهز للانطلاق؟</p>
          <h2 className="landing-section-title mb-5">
            ابدأ بيعك أونلاين{' '}
            <span className="text-primary">اليوم</span>
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-[#64748b] sm:text-lg">
            اختر باقتك، أرسل بياناتك، ونتواصل معك عبر واتساب لتفعيل متجرك في أسرع وقت.
          </p>

          <Link to="/request-access">
            <Button size="lg" className="min-w-[220px] rounded-full px-10 font-semibold group">
              ابدأ الآن — مجاناً
              <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            </Button>
          </Link>

          <p className="mt-4 text-xs text-[#94a3b8]">طلب الوصول مجاني — لا بطاقة ائتمان</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {perks.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#f8fafc] px-3.5 py-1.5 text-xs font-medium text-[#64748b]"
              >
                <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
                {item}
              </span>
            ))}
          </div>

          <p className="mt-8 text-sm text-[#64748b]">
            لديك حساب مفعّل؟{' '}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              سجّل دخولك
            </Link>
          </p>
        </div>
      </FadeUp>
    </div>
  </section>
);

export default LandingFinalCTA;
