
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
  const [billingType, setBillingType] = useState<'monthly' | 'annual'>('monthly');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background font-arabic" dir="rtl">
      {/* Header */}
      <header className={`sticky top-0 z-50 w-full transition-all duration-500 ${scrolled ? 'bg-background/90 backdrop-blur-xl shadow-sm border-b border-border/30' : 'bg-transparent'}`}>
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
              <Button size="sm" className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-5 font-semibold shadow-lg shadow-primary/20">
                ابدأ مجاناً
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[90vh] flex items-center">
        {/* Animated background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-secondary/6 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/3 rounded-full blur-[150px]" />
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        </div>

        <div className="container mx-auto px-4 py-20 lg:py-28 relative z-10">
          <div className="text-center max-w-5xl mx-auto">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-5 py-2.5 rounded-full text-sm font-semibold mb-10"
            >
              <Sparkles className="w-4 h-4" />
              أنشئ متجرك الإلكتروني في دقائق
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold mb-8 leading-[1.1] text-foreground tracking-tight"
            >
              حوّل فكرتك إلى
              <br />
              <span className="relative inline-block mt-3">
                <span className="bg-gradient-to-l from-primary via-secondary to-primary bg-clip-text text-transparent">
                  متجر احترافي
                </span>
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute -bottom-2 right-0 left-0 h-1.5 bg-gradient-to-l from-primary to-secondary rounded-full origin-right"
                />
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed"
            >
              منصة متكاملة لبناء وإدارة متجرك الإلكتروني — بدون برمجة، بدون تعقيد.
              <br />
              <span className="text-foreground/60">ابدأ مجاناً واحصل على كل الأدوات التي تحتاجها.</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Link to="/signup">
                <Button size="lg" className="text-lg px-12 py-7 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 hover:-translate-y-0.5 min-w-[260px] group">
                  ابدأ مجاناً الآن
                  <ArrowLeft className="mr-2 h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg" className="text-lg px-12 py-7 rounded-2xl border-2 border-border/60 hover:border-primary/30 hover:bg-accent text-foreground min-w-[260px] transition-all duration-300">
                  لدي حساب بالفعل
                </Button>
              </Link>
            </motion.div>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="flex items-center justify-center gap-8 sm:gap-16 mt-16 pt-10 border-t border-border/30"
            >
              {stats.map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-foreground">{stat.number}</div>
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
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">ثلاث خطوات فقط</h2>
              <p className="text-lg text-muted-foreground">من الفكرة إلى متجر جاهز للبيع</p>
            </div>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-16 right-[16%] left-[16%] h-0.5 bg-gradient-to-l from-primary/20 via-primary/40 to-primary/20" />

            {steps.map((step, i) => (
              <FadeUp key={i} delay={i * 0.15}>
                <div className="text-center relative group">
                  <div className="w-20 h-20 bg-card border-2 border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/5 group-hover:border-primary/40 group-hover:shadow-primary/15 transition-all duration-300 group-hover:-translate-y-1">
                    <step.icon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-xs font-bold text-primary/60 mb-2 tracking-widest">{step.step}</div>
                  <h3 className="text-xl font-bold text-foreground mb-2">{step.title}</h3>
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
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">كل ما يحتاجه متجرك</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                أدوات متكاملة لإدارة متجرك من الألف إلى الياء
              </p>
            </div>
          </FadeUp>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {features.map((feature, i) => (
              <FadeUp key={i} delay={i * 0.08}>
                <div className="bg-card p-7 rounded-2xl border border-border/40 hover:border-primary/20 transition-all duration-500 group hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 relative overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="relative z-10">
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-primary/15 group-hover:scale-110 transition-all duration-300">
                      <feature.icon className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold mb-2 text-foreground">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-28 bg-muted/20 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[120px]" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <FadeUp>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-2 rounded-full text-sm font-semibold text-primary mb-6">
                <Star className="w-4 h-4" />
                الباقات
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">خطط تسعير بسيطة وشفافة</h2>
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
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  شهري
                </button>
                <button
                  onClick={() => setBillingType('annual')}
                  className={`px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-300 relative ${
                    billingType === 'annual'
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
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
                  className={`bg-card rounded-3xl p-8 md:p-10 border-2 relative hover:shadow-2xl transition-all duration-500 cursor-pointer group ${
                    selectedPlan === 'elite'
                      ? 'border-primary shadow-2xl shadow-primary/15'
                      : 'border-border/50 hover:border-primary/30 shadow-lg'
                  }`}
                >
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-l from-primary to-secondary text-primary-foreground px-6 py-2 rounded-full text-xs font-bold shadow-lg shadow-primary/20">
                    ✨ الباقة المميزة
                  </div>

                  {/* Header - Right aligned */}
                  <div className="flex items-center gap-3 mb-6 pt-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                      <Star className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">باقة النخبة</h3>
                      <p className="text-xs text-muted-foreground">كل ما تحتاجه لمتجر ناجح</p>
                    </div>
                  </div>

                  {/* Price - Right aligned */}
                  <div className="flex items-baseline gap-2 mb-8">
                    <span className="text-6xl font-bold text-foreground">50</span>
                    <div>
                      <div className="text-muted-foreground text-sm">ألف د.ع</div>
                      <div className="text-muted-foreground/70 text-xs">/ شهرياً</div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-border/60 mb-8" />

                  {/* Features - Right aligned */}
                  <div className="mb-8">
                    <p className="text-xs font-bold text-foreground/70 mb-4 tracking-wider">المميزات المتضمنة</p>
                    <ul className="space-y-3.5">
                      {[
                        { text: "عدد الطلبات: غير محدود", highlight: true },
                        { text: "عدد المنتجات: غير محدود", highlight: true },
                        { text: "تحليل البيانات المتقدم", highlight: false },
                        { text: "إدارة الطلبات المتكاملة", highlight: false },
                        { text: "دعم فني أولوية عالية", highlight: false },
                        { text: "عدد الأصناف غير محدود", highlight: false },
                        { text: "شهادة حماية SSL متقدمة", highlight: false },
                        { text: "تخصيص كامل للمتجر", highlight: false },
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.highlight ? 'bg-primary/20' : 'bg-primary/10'}`}>
                            <Check className={`w-3 h-3 ${item.highlight ? 'text-primary' : 'text-primary/70'}`} />
                          </div>
                          <span className={item.highlight ? 'text-foreground font-semibold' : 'text-muted-foreground'}>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl py-6 text-base font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/signup', { state: { selectedPlan: { id: 'elite', name: 'باقة النخبة', price: '50 ألف د.ع' } } });
                    }}
                  >
                    ابدأ الآن مجاناً
                    <ArrowLeft className="mr-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </FadeUp>
          )}

          {billingType === 'annual' && (
            <FadeUp>
              <div className="max-w-lg mx-auto">
                <div
                  onClick={() => setSelectedPlan('annual')}
                  className={`bg-card rounded-3xl p-8 md:p-10 border-2 transition-all duration-500 cursor-pointer group ${
                    selectedPlan === 'annual'
                      ? 'border-primary shadow-2xl shadow-primary/15'
                      : 'border-border/50 hover:border-primary/30 shadow-lg'
                  }`}
                >
                  {/* Header - Right aligned */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                      <Zap className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">باقة 6 أشهر</h3>
                      <p className="text-xs text-muted-foreground">أفضل قيمة لمتجرك</p>
                    </div>
                  </div>

                  {/* Price - Right aligned */}
                  <div className="flex items-baseline gap-3 mb-3">
                    <span className="text-6xl font-bold text-foreground">125</span>
                    <div>
                      <div className="text-muted-foreground line-through text-sm">300 ألف د.ع</div>
                      <div className="text-primary font-semibold text-sm">ألف د.ع / لـ 6 أشهر</div>
                    </div>
                  </div>
                  <div className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-xs font-bold mb-8 inline-block">
                    وفّر 49% مقارنة بالدفع الشهري
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-border/60 mb-8" />

                  {/* Features - Right aligned */}
                  <div className="mb-8">
                    <p className="text-xs font-bold text-foreground/70 mb-4 tracking-wider">المميزات المتضمنة</p>
                    <ul className="space-y-3.5">
                      {["عدد الطلبات: غير محدود", "عدد المنتجات: غير محدود", "تحليل البيانات", "إدارة الطلبات", "دعم فني", "عدد الأصناف غير محدود", "شهادة حماية SSL"].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    size="lg"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl py-6 text-base font-bold shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all duration-300"
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
      <section className="py-28 bg-background relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/3" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/5 rounded-full blur-[150px]" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <FadeUp>
            <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-card via-card to-accent/30 border border-border/40 rounded-[2rem] p-12 md:p-20 shadow-2xl relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-[80px]" />
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-secondary/10 rounded-full blur-[80px]" />
              <div className="absolute top-6 left-6 w-20 h-20 border border-primary/10 rounded-2xl rotate-12 opacity-50" />
              <div className="absolute bottom-6 right-6 w-16 h-16 border border-secondary/10 rounded-full opacity-50" />
              
              <div className="relative z-10">
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-8"
                >
                  <Sparkles className="w-8 h-8 text-primary" />
                </motion.div>
                <h2 className="text-3xl md:text-5xl font-bold mb-5 text-foreground leading-tight">
                  جاهز لإطلاق
                  <span className="bg-gradient-to-l from-primary to-secondary bg-clip-text text-transparent"> متجرك الاحترافي؟</span>
                </h2>
                <p className="text-muted-foreground mb-10 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                  انضم لمئات التجار الناجحين الذين يديرون متاجرهم بكل سهولة عبر منصة بداية
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Link to="/signup">
                    <Button size="lg" className="text-lg px-12 py-7 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 hover:-translate-y-1 group min-w-[240px]">
                      ابدأ مجاناً الآن
                      <ArrowLeft className="mr-2 h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
                {/* Trust indicators */}
                <div className="flex items-center justify-center gap-6 mt-10 pt-8 border-t border-border/30">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Shield className="w-4 h-4 text-primary/70" />
                    <span>حماية كاملة</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-border" />
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Zap className="w-4 h-4 text-primary/70" />
                    <span>إعداد فوري</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-border" />
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Headphones className="w-4 h-4 text-primary/70" />
                    <span>دعم مستمر</span>
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
