
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Star, Zap, Package, BarChart3, Lock, Palette, Headphones, TrendingUp, Sparkles, ShoppingBag, Globe, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
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
  { step: "01", title: "سجّل حسابك", desc: "إنشاء حساب مجاني خلال ثوانٍ", icon: Globe },
  { step: "02", title: "أضف منتجاتك", desc: "ارفع صور وأسعار منتجاتك بسهولة", icon: ShoppingBag },
  { step: "03", title: "ابدأ البيع", desc: "شارك رابط متجرك واستقبل الطلبات", icon: TrendingUp },
];

const Index = () => {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingType, setBillingType] = useState<'monthly' | 'semiannual'>('monthly');
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
            <Link to="/signup">
              <Button size="sm" className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-5 font-semibold">
                ابدأ الآن
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
              <Link to="/signup">
                <Button size="lg" className="min-w-[200px] sm:min-w-[220px] group">
                  ابدأ الآن
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

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-muted/20">
        <div className="container mx-auto px-4">
          <FadeUp>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-2 rounded-full text-sm font-medium text-primary mb-6">
                <Star className="w-4 h-4" strokeWidth={1.75} />
                الباقات
              </div>
              <h2 className="ds-heading-lg mb-3">خطط تسعير بسيطة وشفافة</h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                اختر الخطة المناسبة لعملك وابدأ بثقة — بدون رسوم خفية
              </p>
            </div>
          </FadeUp>

          {/* Billing Toggle */}
          <FadeUp delay={0.1}>
            <div className="flex justify-center mb-14">
              <div className="bg-card border border-border/50 rounded-2xl p-1.5 flex shadow-sm">
                <button
                  onClick={() => setBillingType('monthly')}
                  className={`px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                    billingType === 'monthly'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  شهري
                </button>
                <button
                  onClick={() => setBillingType('semiannual')}
                  className={`px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-300 relative ${
                    billingType === 'semiannual'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  6 أشهر
                  <span className="absolute -top-2.5 -left-2 bg-destructive text-destructive-foreground text-[10px] px-2 py-0.5 rounded-full font-bold">-49%</span>
                </button>
              </div>
            </div>
          </FadeUp>

          {billingType === 'monthly' && (
            <FadeUp>
              <div className="max-w-lg mx-auto">
                <div
                  onClick={() => setSelectedPlan('elite')}
                  className={`bg-card rounded-2xl p-8 md:p-10 border relative transition-colors cursor-pointer ${
                    selectedPlan === 'elite'
                      ? 'border-primary'
                      : 'border-border/50 hover:border-primary/25'
                  }`}
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-5 py-1.5 rounded-full text-xs font-medium">
                    ✨ الباقة المميزة
                  </div>

                  {/* Header */}
                  <div className="flex items-center gap-3 mb-6 pt-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                      <Star className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">باقة النخبة</h3>
                      <p className="text-xs text-foreground/60">كل ما تحتاجه لمتجر ناجح</p>
                    </div>
                  </div>

                  {/* Price - Centered */}
                  <div className="text-center py-6 mb-6 bg-muted/30 rounded-2xl">
                    <div className="flex items-baseline gap-2 justify-center">
                      <span className="text-4xl font-semibold text-foreground tabular-nums">50</span>
                      <span className="text-foreground/70 text-sm font-medium">ألف د.ع / شهرياً</span>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="mb-6">
                    <p className="text-xs font-bold text-foreground/60 mb-4 tracking-wider">المميزات المتضمنة</p>
                    <ul className="space-y-3">
                      {[
                        "عدد الطلبات: غير محدود",
                        "عدد المنتجات: غير محدود",
                        "تحليل البيانات المتقدم",
                        "إدارة الطلبات المتكاملة",
                        "دعم فني أولوية عالية",
                        "عدد الأصناف غير محدود",
                        "شهادة حماية SSL متقدمة",
                        "تخصيص كامل للمتجر",
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    className="w-full rounded-xl py-6 text-base font-semibold"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/signup', { state: { selectedPlan: { id: 'elite', name: 'باقة النخبة', price: '50 ألف د.ع' } } });
                    }}
                  >
                    ابدأ الآن
                    <ArrowLeft className="mr-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </FadeUp>
          )}

          {billingType === 'semiannual' && (
            <FadeUp>
              <div className="max-w-lg mx-auto">
                <div
                  onClick={() => setSelectedPlan('annual')}
                  className={`bg-card rounded-2xl p-8 md:p-10 border transition-colors cursor-pointer ${
                    selectedPlan === 'annual'
                      ? 'border-primary'
                      : 'border-border/50 hover:border-primary/25'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                      <Zap className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">باقة 6 أشهر</h3>
                      <p className="text-xs text-foreground/60">أفضل قيمة لمتجرك</p>
                    </div>
                  </div>

                  {/* Price - Centered */}
                  <div className="text-center py-6 mb-4 bg-muted/30 rounded-2xl">
                    <div className="text-foreground/50 line-through text-sm mb-1">300 ألف د.ع</div>
                    <div className="flex items-baseline gap-2 justify-center">
                      <span className="text-4xl font-semibold text-foreground tabular-nums">125</span>
                      <span className="text-foreground/70 text-sm font-medium">ألف د.ع / لـ 6 أشهر</span>
                    </div>
                  </div>
                  <div className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-xs font-bold mb-6 inline-block">
                    وفّر 49% مقارنة بالدفع الشهري
                  </div>

                  {/* Features */}
                  <div className="mb-6">
                    <p className="text-xs font-bold text-foreground/60 mb-4 tracking-wider">المميزات المتضمنة</p>
                    <ul className="space-y-3">
                      {["عدد الطلبات: غير محدود", "عدد المنتجات: غير محدود", "تحليل البيانات", "إدارة الطلبات", "دعم فني", "عدد الأصناف غير محدود", "شهادة حماية SSL"].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    size="lg"
                    className="w-full rounded-xl py-6 text-base font-semibold"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/signup', { state: { selectedPlan: { id: 'annual', name: 'باقة 6 أشهر', price: '125 ألف د.ع' } } });
                    }}
                  >
                    ابدأ الآن
                    <ArrowLeft className="mr-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </FadeUp>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="pb-24 pt-12 bg-background border-t border-border/40">
        <div className="container mx-auto px-4">
          <FadeUp>
            <div className="max-w-3xl mx-auto text-center ds-card p-10 md:p-14">
              <div className="w-12 h-12 bg-primary/8 rounded-xl flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-6 h-6 text-primary" strokeWidth={1.75} />
              </div>
              <h2 className="ds-heading-lg mb-4">
                جاهز لإطلاق
                <span className="text-primary"> متجرك الاحترافي؟</span>
              </h2>
              <p className="text-muted-foreground mb-8 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
                انضم لمئات التجار الناجحين الذين يديرون متاجرهم بكل سهولة عبر منصة بداية
              </p>
              <Link to="/signup">
                <Button size="lg" className="min-w-[200px] group">
                  ابدأ الآن
                  <ArrowLeft className="mr-1 h-4 w-4 group-hover:-translate-x-0.5 transition-transform" strokeWidth={1.75} />
                </Button>
              </Link>
              <div className="flex flex-wrap items-center justify-center gap-5 mt-8 pt-8 border-t border-border/40">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Shield className="w-4 h-4 text-primary" strokeWidth={1.75} />
                  <span>حماية كاملة</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-border hidden sm:block" />
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Zap className="w-4 h-4 text-primary" strokeWidth={1.75} />
                  <span>إعداد فوري</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-border hidden sm:block" />
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Headphones className="w-4 h-4 text-primary" strokeWidth={1.75} />
                  <span>دعم مستمر</span>
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
