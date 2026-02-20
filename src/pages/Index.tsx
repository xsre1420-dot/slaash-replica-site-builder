
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Star, Zap, Package, BarChart3, Lock, Palette, Headphones, TrendingUp, Sparkles } from "lucide-react";
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
      <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png" alt="بداية" className="h-9 w-auto" />
          </div>
          
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/signup">
              <Button size="sm" className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-5 font-semibold">
                ابدأ مجاناً
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4 py-20 lg:py-32 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            {/* Announcement badge */}
            <div className="inline-flex items-center gap-2 bg-accent border border-border/50 text-accent-foreground px-5 py-2.5 rounded-full text-sm font-medium mb-10 animate-fade-in">
              <Zap className="w-4 h-4 text-primary" />
              إطلاق ميزات جديدة للتجارة الإلكترونية
            </div>
            
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-8 leading-[1.15] animate-fade-in text-foreground tracking-tight">
              أنشئ متجرك
              <br />
              الإلكتروني
              <br />
              خلال دقائق،
              <span className="block mt-3 text-gradient bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">وابدأ البيع اليوم</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-4 max-w-2xl mx-auto leading-relaxed animate-fade-in">
              منصة متكاملة تساعدك على بناء وإدارة
              وتطوير متجرك بكل سهولة
            </p>
            <p className="text-base text-muted-foreground/70 mb-12 animate-fade-in">
              بدون أي خبرة تقنية
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in">
              <Link to="/signup">
                <Button size="lg" className="text-lg px-10 py-7 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl hover:shadow-2xl transition-all duration-300 min-w-[240px]">
                  ابدأ مجاناً الآن
                  <ArrowLeft className="mr-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg" className="text-lg px-10 py-7 rounded-2xl border-2 border-border hover:bg-accent text-foreground min-w-[240px]">
                  لدي حساب بالفعل
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-accent border border-border/50 px-4 py-2 rounded-full text-sm font-medium text-primary mb-6">
              <Sparkles className="w-4 h-4" />
              المميزات
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">كل ما يحتاجه متجرك</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              من إدارة الطلبات إلى تحليل بيانات العملاء، كل الأدوات في مكان واحد
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              { icon: Package, title: "إدارة منتجات ذكية", desc: "نظّم مخزونك وتابع منتجاتك بخطوات بسيطة وبدون أخطاء" },
              { icon: BarChart3, title: "تحليلات لحظية", desc: "لوحات بيانات تفاعلية لتتبع الأداء المالي والتشغيلي" },
              { icon: Lock, title: "أمان متكامل", desc: "بياناتك وبيانات عملائك محمية بنظام حماية متقدم" },
              { icon: Palette, title: "تصميم بدون برمجة", desc: "صمّم متجرك بنفسك بواجهة سهلة دون أي خبرة تقنية" },
              { icon: Headphones, title: "دعم فني متواصل", desc: "فريق دعم متجاوب يساعدك في كل خطوة" },
              { icon: TrendingUp, title: "تقارير الأداء", desc: "تحليلات حيّة تساعدك على اتخاذ قرارات ذكية" },
            ].map((feature, i) => (
              <div key={i} className="bg-card p-8 rounded-2xl border border-border/50 hover:border-primary/20 hover:shadow-lg transition-all duration-300 group">
                <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">خطط تسعير بسيطة</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              اختر الخطة المناسبة وابدأ بثقة
            </p>
          </div>
          
          {/* Billing Toggle */}
          <div className="flex justify-center mb-12">
            <div className="bg-muted rounded-xl p-1 flex">
              <button 
                onClick={() => setBillingType('monthly')}
                className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-300 ${
                  billingType === 'monthly' 
                    ? 'bg-card shadow-sm text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                شهري
              </button>
              <button 
                onClick={() => setBillingType('annual')}
                className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-300 ${
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
                className={`bg-card rounded-3xl p-8 border-2 relative hover:shadow-xl transition-all duration-300 cursor-pointer ${
                  selectedPlan === 'elite' 
                    ? 'border-primary shadow-xl shadow-primary/10' 
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-xs font-medium">
                  الباقة المميزة
                </div>
                <div className="flex items-center gap-2 mb-6 justify-center pt-2">
                  <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                    <Star className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">باقة النخبة</h3>
                </div>
                <div className="flex items-baseline gap-1 mb-8 justify-center">
                  <span className="text-5xl font-bold text-foreground">50</span>
                  <span className="text-muted-foreground text-sm">ألف د.ع / شهرياً</span>
                </div>
                
                <ul className="space-y-3.5 mb-8 text-right">
                  {["عدد الطلبات: غير محدود", "عدد المنتجات: غير محدود", "تحليل البيانات المتقدم", "إدارة الطلبات المتكاملة", "دعم فني أولوية عالية", "عدد الأصناف غير محدود", "شهادة حماية SSL متقدمة", "تخصيص كامل للمتجر"].map((item, i) => (
                    <li key={i} className="text-muted-foreground flex items-center gap-2.5 justify-end text-sm">
                      {item}
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    </li>
                  ))}
                </ul>
                
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-3"
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
            <div className="max-w-lg mx-auto">
              <div 
                onClick={() => setSelectedPlan('annual')}
                className={`bg-card rounded-3xl p-8 text-center border-2 transition-all duration-300 cursor-pointer ${
                  selectedPlan === 'annual' 
                    ? 'border-primary shadow-xl shadow-primary/10' 
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <h3 className="text-2xl font-bold mb-4 text-foreground">باقة 6 أشهر</h3>
                <div className="flex items-center justify-center gap-4 mb-6">
                  <span className="text-5xl font-bold text-foreground">125</span>
                  <div className="text-right">
                    <div className="text-muted-foreground line-through text-sm">300 ألف د.ع</div>
                    <div className="text-primary font-medium text-sm">ألف د.ع / لـ 6 أشهر</div>
                  </div>
                </div>
                <div className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-xs font-medium mb-8 inline-block">
                  أرخص بنسبة 49% من الدفع الشهري
                </div>
                
                <ul className="space-y-3.5 mb-8 max-w-sm mx-auto text-right">
                  {["عدد الطلبات: غير محدود", "عدد المنتجات: غير محدود", "تحليل البيانات", "إدارة الطلبات", "دعم فني", "عدد الأصناف غير محدود", "شهادة حماية SSL"].map((item, i) => (
                    <li key={i} className="text-muted-foreground flex items-center gap-2.5 justify-end text-sm">
                      {item}
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    </li>
                  ))}
                </ul>
                
                <Button 
                  size="lg" 
                  className="px-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
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
          
          <div className="mt-10 text-center">
            <div className="bg-accent/50 border border-primary/10 rounded-2xl p-5 max-w-lg mx-auto">
              <h4 className="text-sm font-bold text-foreground mb-1">✅ ضمان استرجاع الأموال</h4>
              <p className="text-muted-foreground text-sm">
                إذا لم تكن راضياً، سنعيد لك كامل المبلغ خلال أول 7 أيام
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png" alt="بداية" className="h-10 w-auto" />
          </div>
          <p className="text-muted-foreground mb-4 text-sm max-w-md mx-auto">
            منصة شاملة لإنشاء وإدارة المتاجر الإلكترونية بكل سهولة واحترافية
          </p>
          <div className="text-xs text-muted-foreground/60">
            جميع الحقوق محفوظة © 2025 بداية
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
