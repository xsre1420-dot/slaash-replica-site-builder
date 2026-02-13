
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Star, Shield, Zap, Globe, BarChart3, Settings, Package, TrendingUp, Lock, Palette, Headphones, Users, ChevronDown } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useState } from "react";

const Index = () => {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingType, setBillingType] = useState<'monthly' | 'annual'>('monthly');
  
  return (
    <div className="min-h-screen bg-background font-arabic" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png" alt="بداية" className="h-10 w-auto" />
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">الميزات</a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">الأسعار</a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">تواصل معنا</a>
          </nav>
          
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login">
              <Button variant="outline" size="sm" className="hidden sm:inline-flex">
                تسجيل الدخول
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-primary hover:bg-primary/90">
                ابدأ مجاناً
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 lg:py-40">
        <div className="text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-accent text-primary px-6 py-3 rounded-full text-base font-semibold mb-10 animate-fade-in">
            <Zap className="w-5 h-5" />
            إطلاق ميزات جديدة للتجارة الإلكترونية
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold mb-10 leading-[1.1] animate-fade-in text-foreground">
            أنشئ متجرك الإلكتروني
            <span className="block mt-2">خلال دقائق،</span>
            <span className="text-gradient block mt-2 bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">وابدأ البيع اليوم</span>
          </h1>
          
          <p className="text-2xl md:text-3xl text-muted-foreground mb-16 max-w-4xl mx-auto leading-relaxed animate-fade-in font-medium">
            منصة متكاملة تساعدك على بناء وإدارة وتطوير متجرك بكل سهولة
            <span className="block mt-2">بدون أي خبرة تقنية</span>
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/signup">
              <Button size="lg" className="text-xl px-10 py-7 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all">
                ابدأ مجاناً الآن
                <ArrowLeft className="mr-2 h-6 w-6" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" className="text-xl px-10 py-7 rounded-2xl border-2 border-border hover:bg-muted text-foreground">
                لدي حساب بالفعل
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-8 leading-tight text-foreground">كل ما يحتاجه متجرك<span className="block mt-2">في مكان واحد</span></h2>
            <p className="text-2xl text-muted-foreground max-w-4xl mx-auto leading-relaxed font-medium">
              من إدارة الطلبات إلى تحليل بيانات العملاء
            </p>
            <p className="text-xl text-muted-foreground mt-4 max-w-4xl mx-auto leading-relaxed">
              كل الأدوات التي تحتاجها لبناء متجرك وتنميته بثقة
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {[
              { icon: Package, title: "إدارة منتجات ذكية وسهلة", desc: "نظّم مخزونك وتابع منتجاتك بخطوات بسيطة. قل وداعًا للأخطاء اليدوية، ومرحبًا بالكفاءة." },
              { icon: BarChart3, title: "تحليلات لحظية تقود قراراتك", desc: "لوحات بيانات تفاعلية تُمكِّنك من تتبع الأداء المالي والتشغيلي في الوقت الفعلي." },
              { icon: Lock, title: "راحة بالك تبدأ من هنا", desc: "بياناتك وبيانات عملائك في أيدٍ أمينة مع نظام حماية متكامل." },
              { icon: Palette, title: "تصميم بدون برمجة", desc: "صمّم متجرك بنفسك دون أي خبرة تقنية. واجهة سهلة تمنحك تحكماً كاملاً." },
              { icon: Headphones, title: "دعم فني حقيقي", desc: "فريق دعم متجاوب وسريع يساعدك خطوة بخطوة في رحلتك التجارية." },
              { icon: TrendingUp, title: "تابع أداء متجرك لحظياً", desc: "تحليلات حيّة ولوحات بيانات تساعدك على اتخاذ قرارات ذكية بثقة." },
            ].map((feature, i) => (
              <div key={i} className="bg-card p-10 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group border border-border/50 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-5 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-28 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-8 leading-tight text-foreground">خطط تسعير واضحة<span className="block mt-2">تناسب كل مرحلة من نموك</span></h2>
            <p className="text-2xl text-muted-foreground max-w-4xl mx-auto leading-relaxed font-medium">
              اختر الخطة التي تناسب حجم أعمالك واحتياجاتك، وابدأ بثقة
            </p>
          </div>
          
          {/* Billing Toggle */}
          <div className="flex justify-center mb-12">
            <div className="bg-muted rounded-xl p-1 flex">
              <button 
                onClick={() => setBillingType('monthly')}
                className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 ${
                  billingType === 'monthly' 
                    ? 'bg-card shadow-sm text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                شهري
              </button>
              <button 
                onClick={() => setBillingType('annual')}
                className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 ${
                  billingType === 'annual' 
                    ? 'bg-card shadow-sm text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                6 أشهر
              </button>
            </div>
          </div>
          
          {billingType === 'monthly' && (
            <div className="max-w-md mx-auto">
              <div 
                onClick={() => setSelectedPlan('elite')}
                className={`bg-card rounded-2xl p-8 shadow-lg border-2 relative hover:shadow-xl transition-all duration-300 cursor-pointer ${
                  selectedPlan === 'elite' 
                    ? 'border-primary ring-2 ring-primary/20 transform scale-105' 
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium">
                  الباقة المميزة
                </div>
                <div className="flex items-center gap-2 mb-4 justify-center">
                  <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                    <Star className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">باقة النخبة</h3>
                </div>
                <div className="flex items-baseline gap-1 mb-6 justify-center">
                  <span className="text-4xl font-bold text-foreground">50</span>
                  <span className="text-muted-foreground">ألف د.ع / شهرياً</span>
                </div>
                
                <ul className="space-y-4 mb-8 text-right">
                  {["عدد الطلبات: غير محدود", "عدد المنتجات: غير محدود", "تحليل البيانات المتقدم", "إدارة الطلبات المتكاملة", "دعم فني أولوية عالية", "عدد الأصناف غير محدود", "شهادة حماية SSL متقدمة", "تخصيص كامل للمتجر"].map((item, i) => (
                    <li key={i} className="text-muted-foreground flex items-center gap-2 justify-end">
                      {item}
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    </li>
                  ))}
                </ul>
                
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/signup', { state: { selectedPlan: { id: 'elite', name: 'باقة النخبة', price: '50 ألف د.ع' } } });
                  }}
                >
                  ابدأ الآن
                </Button>
              </div>
            </div>
          )}
          
          {billingType === 'annual' && (
            <div className="max-w-2xl mx-auto">
              <div 
                onClick={() => setSelectedPlan('annual')}
                className={`bg-accent/30 rounded-3xl p-8 text-center border-2 transition-all duration-300 cursor-pointer ${
                  selectedPlan === 'annual' 
                    ? 'border-primary ring-2 ring-primary/20 transform scale-105' 
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <h3 className="text-3xl font-bold mb-4 text-foreground">باقة 6 أشهر</h3>
                <div className="flex items-center justify-center gap-4 mb-6">
                  <span className="text-5xl font-bold text-foreground">125</span>
                  <div className="text-right">
                    <div className="text-muted-foreground line-through">300 ألف د.ع</div>
                    <div className="text-primary font-medium">ألف د.ع / لـ 6 أشهر</div>
                  </div>
                </div>
                <div className="bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6 inline-block">
                  أرخص بنسبة 49% من الدفع الشهري
                </div>
                
                <ul className="space-y-4 mb-8 max-w-md mx-auto text-right">
                  {["عدد الطلبات: غير محدود", "عدد المنتجات: غير محدود", "تحليل البيانات", "إدارة الطلبات", "دعم فني", "عدد الأصناف غير محدود", "شهادة حماية SSL"].map((item, i) => (
                    <li key={i} className="text-muted-foreground flex items-center gap-2 justify-end">
                      {item}
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    </li>
                  ))}
                </ul>
                
                <Button 
                  size="lg" 
                  className="px-8 py-4 text-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/signup', { state: { selectedPlan: { id: 'annual', name: 'باقة 6 أشهر', price: '125 ألف د.ع' } } });
                  }}
                >
                  ابدأ الآن
                </Button>
              </div>
            </div>
          )}
          
          <div className="mt-12 text-center">
            <div className="bg-accent/50 border border-primary/20 rounded-xl p-6 max-w-2xl mx-auto">
              <h4 className="text-lg font-bold text-foreground mb-2">✅ ضمان استرجاع الأموال</h4>
              <p className="text-muted-foreground">
                إذا لم تكن راضياً، سنعيد لك كامل المبلغ خلال أول 7 أيام – بدون أي أسباب
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-8">
              <img src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png" alt="بداية" className="h-20 w-auto" />
            </div>
            <p className="text-background/70 mb-10 max-w-lg mx-auto text-xl leading-relaxed">
              منصة شاملة لإنشاء وإدارة المتاجر الإلكترونية بكل سهولة واحترافية
            </p>
            <div className="text-base text-background/50">
              جميع الحقوق محفوظة © 2025 نومو. منصة المتاجر الإلكترونية
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
