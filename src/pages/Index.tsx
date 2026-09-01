
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Rocket, Check } from "lucide-react";
import ElitePricingCard from "@/components/landing/ElitePricingCard";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import FeaturesRoadmapSection from "@/components/landing/FeaturesRoadmapSection";
import LandingHeroSection from "@/components/landing/LandingHeroSection";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingSectionHeader from "@/components/landing/LandingSectionHeader";
import { FadeUp } from "@/components/landing/FadeUp";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useReducedMotion, motion } from "framer-motion";
import { useLandingPageBundle } from "@/hooks/useLandingPageBundle";

const Index = () => {
  const [scrolled, setScrolled] = useState(false);
  const reducedMotion = useReducedMotion();
  useLandingPageBundle();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background font-arabic" dir="rtl">
      <LandingHeader scrolled={scrolled} />
      <LandingHeroSection />

      <HowItWorksSection />

      <FeaturesRoadmapSection />

      {/* Pricing */}
      <section id="pricing" className="lp-section lp-section-muted relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 lp-grid-subtle" aria-hidden />
        <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-primary/[0.05] blur-3xl" aria-hidden />

        <div className="container relative z-10 mx-auto px-4">
          <FadeUp>
            <LandingSectionHeader
              icon={Sparkles}
              eyebrow="باقات الاشتراك"
              title={
                <>
                  <span className="text-primary">باقة النخبة</span> — كل ما يحتاجه متجرك
                </>
              }
              subtitle="اختر مدة الاشتراك المناسبة — 6 أشهر أو سنة — ثم أرسل بياناتك ونتواصل معك عبر واتساب لإكمال التفعيل."
              className="mb-14 sm:mb-16"
            />
          </FadeUp>

          <FadeUp delay={0.1}>
            <ElitePricingCard />
          </FadeUp>
        </div>
      </section>

      {/* Final CTA */}
      <section id="contact" className="lp-section relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-muted/25" aria-hidden />
        <div className="pointer-events-none absolute inset-0 lp-grid-subtle" aria-hidden />
        <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl" aria-hidden />

        <div className="container relative z-10 mx-auto px-4">
          <FadeUp>
            <div className="mx-auto max-w-3xl">
              <div className="relative rounded-3xl bg-gradient-to-br from-primary/25 via-border/30 to-primary/10 p-px shadow-xl shadow-primary/[0.05]">
                <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-card/95 p-8 text-center backdrop-blur-sm sm:p-12">
                  <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-primary/[0.05] blur-3xl" aria-hidden />

                  <div className="relative">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4 }}
                      className="lp-badge mb-6"
                    >
                      <Rocket className="h-4 w-4" strokeWidth={1.75} />
                      خطوتك الأولى نحو البيع أونلاين
                    </motion.div>

                    <h2 className="ds-heading-lg mb-5 leading-tight">
                      لا تنتظر الفرصة —{' '}
                      <span className="text-primary">ابنِ متجرك وابدأ البيع</span>
                    </h2>

                    <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
                      اخترت باقتك؟ أرسل بياناتك الآن — فريقنا يتواصل معك عبر واتساب لتأكيد الباقة
                      وتفعيل متجرك{' '}
                      <span className="font-medium text-foreground">في أسرع وقت.</span>
                    </p>

                    <motion.div whileHover={reducedMotion ? undefined : { scale: 1.02 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }} className="inline-block">
                      <Link to="/request-access">
                        <Button
                          size="lg"
                          className="group min-h-[52px] min-w-[240px] px-10 py-6 text-base font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25"
                        >
                          ابدأ الآن
                          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" strokeWidth={2} />
                        </Button>
                      </Link>
                    </motion.div>

                    <p className="mt-4 text-xs text-muted-foreground/80">
                      مجاني طلب الوصول — لا بطاقة ائتمان
                    </p>

                    <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:gap-x-8">
                      {[
                        "أسعار واضحة على الموقع",
                        "رد سريع عبر واتساب",
                        "تفعيل ودعم من اليوم الأول",
                      ].map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground sm:text-sm"
                        >
                          <Check className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} />
                          {item}
                        </span>
                      ))}
                    </div>

                    <p className="mt-8 text-sm text-muted-foreground">
                      لديك حساب مفعّل؟{' '}
                      <Link to="/login" className="font-semibold text-primary transition-colors hover:underline">
                        سجّل دخولك من هنا
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <img src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png" alt="بداية" className="h-10 w-auto" />
          </div>
          <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
            منصة شاملة لإنشاء وإدارة المتاجر الإلكترونية بكل سهولة واحترافية
          </p>
          <div className="text-xs text-muted-foreground/50">
            جميع الحقوق محفوظة © 2025 بداية
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
