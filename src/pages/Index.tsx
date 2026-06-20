
import { Button } from "@/components/ui/button";
import { ArrowLeft, Zap, Package, BarChart3, Lock, Palette, Headphones, TrendingUp, Sparkles, Smartphone, Check, Rocket, Phone } from "lucide-react";
import ElitePricingCard from "@/components/landing/ElitePricingCard";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";

const FadeUp = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const stats = [
  { number: "500+", label: "متجر نشط" },
  { number: "50K+", label: "طلب شهري" },
  { number: "99.9%", label: "وقت تشغيل" },
];

const features = [
  {
    icon: Package,
    tag: "مخزون",
    title: "منتجات ومخزون في مكان واحد",
    desc: "أضف منتجاتك، عدّل الكميات، وتابع الحركة — دون جداول معقدة أو أخطاء يدوية.",
    iconBg: "bg-primary/10 group-hover:bg-primary/15",
    iconColor: "text-primary",
    ring: "ring-primary/10 group-hover:ring-primary/25",
    featured: true,
  },
  {
    icon: BarChart3,
    tag: "تحليلات",
    title: "لوحة تحكم لحظية",
    desc: "شاهد مبيعاتك وزياراتك وأداء متجرك لحظة بلحظة من شاشة واحدة واضحة.",
    iconBg: "bg-emerald-500/10 group-hover:bg-emerald-500/15",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/10 group-hover:ring-emerald-500/25",
  },
  {
    icon: Lock,
    tag: "أمان",
    title: "حماية لبياناتك وبيانات عملائك",
    desc: "تشفير، صلاحيات، ونسخ احتياطي — ركّز على البيع واترك الأمان لنا.",
    iconBg: "bg-violet-500/10 group-hover:bg-violet-500/15",
    iconColor: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/10 group-hover:ring-violet-500/25",
  },
  {
    icon: Palette,
    tag: "تصميم",
    title: "صمّم متجرك بنفسك",
    desc: "غيّر الألوان والشعار والصفحات بسهولة — بدون مطوّر ولا سطر كود.",
    iconBg: "bg-amber-500/10 group-hover:bg-amber-500/15",
    iconColor: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/10 group-hover:ring-amber-500/25",
  },
  {
    icon: Headphones,
    tag: "دعم",
    title: "دعم يرافقك خطوة بخطوة",
    desc: "فريقنا جاهز عندما تحتاج مساعدة في الإعداد، التشغيل، أو حل أي عائق.",
    iconBg: "bg-sky-500/10 group-hover:bg-sky-500/15",
    iconColor: "text-sky-600 dark:text-sky-400",
    ring: "ring-sky-500/10 group-hover:ring-sky-500/25",
  },
  {
    icon: Smartphone,
    tag: "جوال",
    title: "تجربة مثالية على الهاتف",
    desc: "متجرك يبدو احترافياً على الجوال والتابلت — لأن أغلب زبائنك يتصفحون من هناك.",
    iconBg: "bg-rose-500/10 group-hover:bg-rose-500/15",
    iconColor: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/10 group-hover:ring-rose-500/25",
  },
];

const steps = [
  { step: "01", title: "اختر مدة اشتراكك", desc: "6 أشهر أو سنة — بسعر واضح", icon: Package },
  { step: "02", title: "أرسل بياناتك", desc: "الاسم ورقم واتساب للتواصل", icon: Phone },
  { step: "03", title: "ابدأ البيع", desc: "نفعّل حسابك ومتجرك", icon: TrendingUp },
];

type FeatureItem = (typeof features)[number];

const FeatureCard = ({ feature, index }: { feature: FeatureItem; index: number }) => {
  const Icon = feature.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      className={feature.featured ? "md:col-span-2 lg:col-span-2" : undefined}
    >
      <div
        className={`group relative h-full overflow-hidden rounded-2xl border border-border/50 bg-card p-6 sm:p-7 ring-1 ring-inset transition-all duration-300 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/[0.06] ${feature.ring}`}
      >
        <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-primary/[0.04] blur-3xl transition-opacity duration-500 group-hover:opacity-100 opacity-0" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className={`relative flex h-full flex-col ${feature.featured ? "sm:flex-row sm:items-start sm:gap-6" : ""}`}>
          <div className={`mb-4 flex items-start justify-between gap-3 ${feature.featured ? "sm:mb-0 sm:shrink-0" : ""}`}>
            <motion.div
              whileHover={{ scale: 1.08, rotate: -4 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-300 ${feature.iconBg}`}
            >
              <Icon className={`h-6 w-6 ${feature.iconColor}`} strokeWidth={1.75} />
            </motion.div>
            <span className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors group-hover:border-primary/20 group-hover:text-primary">
              {feature.tag}
            </span>
          </div>

          <div className="flex flex-1 flex-col">
            <h3 className="mb-2 text-base font-semibold text-foreground transition-colors group-hover:text-primary sm:text-lg">
              {feature.title}
            </h3>
            <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>

            <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-primary opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100">
              <span>اكتشف المزيد</span>
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const Index = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background font-arabic" dir="rtl">
      {/* Header */}
      <header className={`sticky top-0 z-50 w-full transition-colors duration-200 ${scrolled ? 'bg-background/95 border-b border-border/40' : 'bg-transparent'}`}>
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png" alt="بداية" className="h-9 w-auto" />
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login">
              <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground hover:text-foreground">
                تسجيل الدخول
              </Button>
            </Link>
            <a href="#pricing">
              <Button size="sm" className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-5 font-semibold">
                الباقات
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/40 bg-muted/25">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.05)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.05)_1px,transparent_1px)] bg-[size:48px_48px]" />
        </div>

        <div className="container mx-auto px-4 py-16 sm:py-20 lg:py-24 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 bg-primary/8 border border-primary/15 text-primary px-4 py-2 rounded-full text-sm font-medium mb-8"
            >
              <Sparkles className="w-4 h-4" strokeWidth={1.75} />
              أنشئ متجرك الإلكتروني في دقائق
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="ds-display mb-6"
            >
              حوّل فكرتك إلى{' '}
              <span className="text-primary">متجر احترافي</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.18 }}
              className="ds-body-lg mb-10 max-w-xl mx-auto"
            >
              منصة متكاملة لبناء وإدارة متجرك الإلكتروني — بدون برمجة، بدون تعقيد.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.28 }}
              className="flex flex-col sm:flex-row gap-3 justify-center items-center"
            >
              <a href="#pricing">
                <Button size="lg" className="min-w-[200px] sm:min-w-[220px] group">
                  ابدأ الآن
                  <ArrowLeft className="mr-1 h-4 w-4 group-hover:-translate-x-0.5 transition-transform" strokeWidth={1.75} />
                </Button>
              </a>
              <Link to="/login">
                <Button variant="outline" size="lg" className="min-w-[200px] sm:min-w-[220px]">
                  لدي حساب بالفعل
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.38 }}
              className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 mt-14 pt-8 border-t border-border/40"
            >
              {stats.map((stat, i) => (
                <div key={i} className="text-center min-w-[80px]">
                  <div className="text-2xl sm:text-3xl font-semibold text-foreground tabular-nums">{stat.number}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-muted/20 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <FadeUp>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-2 rounded-full text-sm font-semibold text-primary mb-6">
                <Zap className="w-4 h-4" />
                كيف يعمل
              </div>
              <h2 className="ds-heading-lg mb-3">ثلاث خطوات فقط</h2>
              <p className="text-lg text-muted-foreground">من الفكرة إلى متجر جاهز للبيع</p>
            </div>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-16 right-[16%] left-[16%] h-0.5 bg-gradient-to-l from-primary/20 via-primary/40 to-primary/20" />

            {steps.map((step, i) => (
              <FadeUp key={i} delay={i * 0.15}>
                <div className="text-center relative group">
                  <div className="w-16 h-16 bg-card border border-border/60 rounded-xl flex items-center justify-center mx-auto mb-5 group-hover:border-primary/30 transition-colors">
                    <step.icon className="w-7 h-7 text-primary" strokeWidth={1.75} />
                  </div>
                  <div className="text-xs font-medium text-primary/70 mb-2 tracking-wide">{step.step}</div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative overflow-hidden bg-background py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.04)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.04)_1px,transparent_1px)] bg-[size:56px_56px]" />
          <div className="absolute -right-24 top-1/4 h-72 w-72 rounded-full bg-primary/[0.04] blur-3xl" />
          <div className="absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-secondary/[0.06] blur-3xl" />
        </div>

        <div className="container relative z-10 mx-auto px-4">
          <FadeUp>
            <div className="mx-auto mb-14 max-w-3xl text-center sm:mb-16">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                <Sparkles className="h-4 w-4" strokeWidth={1.75} />
                لماذا بداية؟
              </div>
              <h2 className="ds-heading-lg mb-4">
                كل ما تحتاجه <span className="text-primary">لتنمية متجرك</span>
              </h2>
              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
                من إدارة المنتجات إلى تتبع المبيعات — أدوات عملية مصمّمة لتجّار التجزئة
                الذين يريدون النمو بسرعة دون تعقيد.
              </p>
            </div>
          </FadeUp>

          <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <FeatureCard key={feature.title} feature={feature} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative overflow-hidden bg-muted/20 py-24 sm:py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.04)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
          <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-primary/[0.05] blur-3xl" />
        </div>

        <div className="container relative z-10 mx-auto px-4">
          <FadeUp>
            <div className="mx-auto mb-14 max-w-3xl text-center sm:mb-16">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                <Sparkles className="h-4 w-4" strokeWidth={1.75} />
                باقات الاشتراك
              </div>
              <h2 className="ds-heading-lg mb-4">
                <span className="text-primary">باقة النخبة</span> — كل ما يحتاجه متجرك
              </h2>
              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
                اختر مدة الاشتراك المناسبة — 6 أشهر أو سنة — ثم أرسل بياناتك
                ونتواصل معك عبر واتساب لإكمال التفعيل.
              </p>
            </div>
          </FadeUp>

          <FadeUp delay={0.1}>
            <ElitePricingCard />
          </FadeUp>
        </div>
      </section>

      {/* Final CTA */}
      <section id="contact" className="relative overflow-hidden py-24 sm:py-28">
        <div className="pointer-events-none absolute inset-0 bg-muted/30" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.05)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.05)_1px,transparent_1px)] bg-[size:48px_48px]" />
          <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl" />
        </div>

        <div className="container relative z-10 mx-auto px-4">
          <FadeUp>
            <div className="mx-auto max-w-3xl">
              <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-primary/30 via-border/40 to-primary/10 shadow-xl shadow-primary/[0.06]">
                <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-card/95 p-8 text-center backdrop-blur-sm sm:p-12">
                  <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-primary/[0.06] blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-secondary/[0.08] blur-3xl" />

                  <div className="relative">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4 }}
                      className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary"
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

                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="inline-block">
                      <Link to="/request-access">
                        <Button
                          size="lg"
                          className="group min-h-[52px] min-w-[240px] rounded-xl px-10 py-6 text-base font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
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
                          className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground sm:text-sm"
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
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png" alt="بداية" className="h-10 w-auto" />
          </div>
          <p className="text-muted-foreground mb-6 text-sm max-w-md mx-auto">
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
