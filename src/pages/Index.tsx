
import { Button } from "@/components/ui/button";
import { ArrowLeft, Zap, Package, BarChart3, Lock, Palette, Headphones, TrendingUp, Sparkles, Globe, Shield } from "lucide-react";
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
  { icon: Package, title: "إدارة منتجات ذكية", desc: "نظّم مخزونك وتابع منتجاتك بخطوات بسيطة وبدون أخطاء", color: "from-primary/20 to-primary/5" },
  { icon: BarChart3, title: "تحليلات لحظية", desc: "لوحات بيانات تفاعلية لتتبع الأداء المالي والتشغيلي", color: "from-secondary/20 to-secondary/5" },
  { icon: Lock, title: "أمان متكامل", desc: "بياناتك وبيانات عملائك محمية بنظام حماية متقدم", color: "from-primary/20 to-primary/5" },
  { icon: Palette, title: "تصميم بدون برمجة", desc: "صمّم متجرك بنفسك بواجهة سهلة دون أي خبرة تقنية", color: "from-secondary/20 to-secondary/5" },
  { icon: Headphones, title: "دعم فني متواصل", desc: "فريق دعم متجاوب يساعدك في كل خطوة", color: "from-primary/20 to-primary/5" },
  { icon: TrendingUp, title: "تقارير الأداء", desc: "تحليلات حيّة تساعدك على اتخاذ قرارات ذكية", color: "from-secondary/20 to-secondary/5" },
];

const steps = [
  { step: "01", title: "اطلب الوصول", desc: "أرسل اسمك ورقم واتساب", icon: Globe },
  { step: "02", title: "تواصل مع المبيعات", desc: "نحدد الباقة المناسبة لك", icon: Headphones },
  { step: "03", title: "ابدأ البيع", desc: "نفعّل حسابك ومتجرك", icon: TrendingUp },
];

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
            <Link to="/request-access">
              <Button size="sm" className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-5 font-semibold">
                طلب الوصول
              </Button>
            </Link>
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
              <Link to="/request-access">
                <Button size="lg" className="min-w-[200px] sm:min-w-[220px] group">
                  طلب الوصول
                  <ArrowLeft className="mr-1 h-4 w-4 group-hover:-translate-x-0.5 transition-transform" strokeWidth={1.75} />
                </Button>
              </Link>
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
      <section id="features" className="py-24 bg-background relative">
        <div className="container mx-auto px-4">
          <FadeUp>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-2 rounded-full text-sm font-semibold text-primary mb-6">
                <Shield className="w-4 h-4" />
                المميزات
              </div>
              <h2 className="ds-heading-lg mb-3">كل ما يحتاجه متجرك</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                أدوات متكاملة لإدارة متجرك من الألف إلى الياء
              </p>
            </div>
          </FadeUp>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {features.map((feature, i) => (
              <FadeUp key={i} delay={i * 0.08}>
                <div className="bg-card p-6 rounded-xl border border-border/50 hover:border-primary/20 transition-colors group">
                  <div className="relative">
                    <div className="w-11 h-11 bg-primary/8 rounded-lg flex items-center justify-center mb-4">
                      <feature.icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
                    </div>
                    <h3 className="text-base font-semibold mb-2 text-foreground">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Contact / Request Access — no public pricing */}
      <section id="contact" className="py-24 bg-muted/20">
        <div className="container mx-auto px-4">
          <FadeUp>
            <div className="max-w-2xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-2 rounded-full text-sm font-medium text-primary mb-6">
                <Headphones className="w-4 h-4" strokeWidth={1.75} />
                تواصل معنا
              </div>
              <h2 className="ds-heading-lg mb-3">باقات مخصصة لاحتياجاتك</h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
                لا نعرض الأسعار علناً — فريق المبيعات يتواصل معك عبر واتساب لتحديد الباقة
                المناسبة لحجم متجرك وأهدافك.
              </p>
              <Link to="/request-access">
                <Button size="lg" className="min-w-[220px] rounded-xl py-6 text-base font-semibold group">
                  طلب الوصول
                  <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground mt-6">
                لديك حساب مفعّل؟{' '}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  تسجيل الدخول
                </Link>
              </p>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden bg-muted/20 border-t border-border/40">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.04)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/60" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <FadeUp>
            <div className="max-w-2xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-2 rounded-full text-sm font-semibold text-primary mb-6">
                <Sparkles className="w-4 h-4" strokeWidth={1.75} />
                ابدأ الآن
              </div>

              <h2 className="ds-heading-lg mb-3 leading-tight">
                أطلق <span className="text-primary">متجرك</span> اليوم
              </h2>

              <p className="text-muted-foreground mb-8 text-base max-w-md mx-auto">
                بيع خلال دقائق — بدون برمجة.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-8">
                <Link to="/request-access">
                  <Button size="lg" className="min-w-[200px] group font-semibold">
                    طلب الوصول
                    <ArrowLeft className="mr-1 h-4 w-4 group-hover:-translate-x-0.5 transition-transform" strokeWidth={1.75} />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" size="lg" className="min-w-[200px]">
                    تسجيل الدخول
                  </Button>
                </Link>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-muted-foreground text-xs sm:text-sm">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={1.75} />
                  <span>حماية</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={1.75} />
                  <span>إعداد سريع</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={1.75} />
                  <span>دعم</span>
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
