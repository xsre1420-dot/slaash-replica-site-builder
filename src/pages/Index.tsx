
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Star, Shield, Zap, Globe, BarChart3, Settings, Package, TrendingUp, Lock, Palette, Headphones, Users, ChevronDown } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

const Index = () => {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingType, setBillingType] = useState<'monthly' | 'annual'>('monthly');
  
  return (
    <div className="min-h-screen bg-white font-arabic" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png" alt="بداية" className="h-10 w-auto" />
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">الميزات</a>
            <a href="#pricing" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">الأسعار</a>
            <a href="#" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">تواصل معنا</a>
          </nav>
          
          <div className="flex items-center gap-3">
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
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-primary/10 to-secondary/10 text-primary px-6 py-3 rounded-full text-base font-semibold mb-10 animate-fade-in shadow-sm">
            <Zap className="w-5 h-5" />
            إطلاق ميزات جديدة للتجارة الإلكترونية
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold mb-10 leading-[1.1] animate-fade-in">
            أنشئ متجرك الإلكتروني
            <span className="block mt-2">خلال دقائق،</span>
            <span className="text-gradient block mt-2 bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">وابدأ البيع اليوم</span>
          </h1>
          
          <p className="text-2xl md:text-3xl text-gray-700 mb-16 max-w-4xl mx-auto leading-relaxed animate-fade-in font-medium">
            منصة متكاملة تساعدك على بناء وإدارة وتطوير متجرك بكل سهولة
            <span className="block mt-2 text-gray-600">بدون أي خبرة تقنية</span>
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/signup">
              <Button size="lg" className="text-xl px-10 py-7 rounded-2xl bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg hover:shadow-xl transition-all">
                ابدأ مجاناً الآن
                <ArrowLeft className="mr-2 h-6 w-6" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" className="text-xl px-10 py-7 rounded-2xl border-2 hover:bg-gray-50">
                لدي حساب بالفعل
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-28 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-8 leading-tight">كل ما يحتاجه متجرك<span className="block mt-2">في مكان واحد</span></h2>
            <p className="text-2xl text-gray-700 max-w-4xl mx-auto leading-relaxed font-medium">
              من إدارة الطلبات إلى تحليل بيانات العملاء
            </p>
            <p className="text-xl text-gray-600 mt-4 max-w-4xl mx-auto leading-relaxed">
              كل الأدوات التي تحتاجها لبناء متجرك وتنميته بثقة
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10 max-w-7xl mx-auto">
            <div className="bg-white p-10 rounded-3xl shadow-md hover:shadow-2xl transition-all duration-300 group border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <Package className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-5 text-gray-900">إدارة منتجات ذكية وسهلة</h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                نظّم مخزونك وتابع منتجاتك بخطوات بسيطة. قل وداعًا للأخطاء اليدوية، ومرحبًا بالكفاءة.
              </p>
            </div>
            
            <div className="bg-white p-10 rounded-3xl shadow-md hover:shadow-2xl transition-all duration-300 group border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-5 text-gray-900">تحليلات لحظية تقود قراراتك</h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                لوحات بيانات تفاعلية تُمكِّنك من تتبع الأداء المالي والتشغيلي في الوقت الفعلي.
              </p>
            </div>
            
            <div className="bg-white p-10 rounded-3xl shadow-md hover:shadow-2xl transition-all duration-300 group border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-5 text-gray-900">راحة بالك تبدأ من هنا</h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                بياناتك وبيانات عملائك في أيدٍ أمينة مع نظام حماية متكامل.
              </p>
            </div>
            
            <div className="bg-white p-10 rounded-3xl shadow-md hover:shadow-2xl transition-all duration-300 group border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <Palette className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-5 text-gray-900">تصميم بدون برمجة</h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                صمّم متجرك بنفسك دون أي خبرة تقنية. واجهة سهلة تمنحك تحكماً كاملاً.
              </p>
            </div>
            
            <div className="bg-white p-10 rounded-3xl shadow-md hover:shadow-2xl transition-all duration-300 group border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <Headphones className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-5 text-gray-900">دعم فني حقيقي</h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                فريق دعم متجاوب وسريع يساعدك خطوة بخطوة في رحلتك التجارية.
              </p>
            </div>
            
            <div className="bg-white p-10 rounded-3xl shadow-md hover:shadow-2xl transition-all duration-300 group border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-5 text-gray-900">تابع أداء متجرك لحظياً</h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                تحليلات حيّة ولوحات بيانات تساعدك على اتخاذ قرارات ذكية بثقة.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-28 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-8 leading-tight">خطط تسعير واضحة<span className="block mt-2">تناسب كل مرحلة من نموك</span></h2>
            <p className="text-2xl text-gray-700 max-w-4xl mx-auto leading-relaxed font-medium">
              اختر الخطة التي تناسب حجم أعمالك واحتياجاتك، وابدأ بثقة
            </p>
          </div>
          
          {/* Billing Toggle */}
          <div className="flex justify-center mb-12">
            <div className="bg-gray-100 rounded-xl p-1 flex">
              <button 
                onClick={() => setBillingType('monthly')}
                className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 ${
                  billingType === 'monthly' 
                    ? 'bg-white shadow-sm text-primary' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                شهري
              </button>
              <button 
                onClick={() => setBillingType('annual')}
                className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 ${
                  billingType === 'annual' 
                    ? 'bg-white shadow-sm text-primary' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                6 أشهر
              </button>
            </div>
          </div>
          
          {/* Monthly Plans */}
          {billingType === 'monthly' && (
            <div className="max-w-md mx-auto">
              {/* Elite Plan */}
              <div 
                onClick={() => setSelectedPlan('elite')}
                className={`bg-white rounded-2xl p-8 shadow-lg border-2 relative hover:shadow-xl transition-all duration-300 cursor-pointer ${
                  selectedPlan === 'elite' 
                    ? 'border-primary ring-2 ring-primary/20 transform scale-105' 
                    : 'border-primary/20 hover:border-primary/40'
                }`}
              >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white px-4 py-2 rounded-full text-sm font-medium">
                  الباقة المميزة
                </div>
                <div className="flex items-center gap-2 mb-4 justify-center">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <div className="w-4 h-4 bg-amber-500 rounded-sm"></div>
                  </div>
                  <h3 className="text-2xl font-bold">باقة النخبة</h3>
                </div>
                <div className="flex items-baseline gap-1 mb-6 justify-center">
                  <span className="text-4xl font-bold">50</span>
                  <span className="text-gray-600">ألف د.ع / شهرياً</span>
                </div>
                
                <ul className="space-y-4 mb-8 text-right">
                  <li className="text-gray-700">عدد الطلبات: غير محدود</li>
                  <li className="text-gray-700">عدد المنتجات: غير محدود</li>
                  <li className="text-gray-700">تحليل البيانات المتقدم</li>
                  <li className="text-gray-700">إدارة الطلبات المتكاملة</li>
                  <li className="text-gray-700">دعم فني أولوية عالية</li>
                  <li className="text-gray-700">عدد الأصناف غير محدود</li>
                  <li className="text-gray-700">شهادة حماية SSL متقدمة</li>
                  <li className="text-gray-700">تخصيص كامل للمتجر</li>
                </ul>
                
                <Button 
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
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
          
          {/* Annual Plan */}
          {billingType === 'annual' && (
            <div className="max-w-2xl mx-auto">
              <div 
                onClick={() => setSelectedPlan('annual')}
                className={`bg-gradient-to-r from-primary/5 to-secondary/5 rounded-3xl p-8 text-center border-2 transition-all duration-300 cursor-pointer ${
                  selectedPlan === 'annual' 
                    ? 'border-primary ring-2 ring-primary/20 transform scale-105' 
                    : 'border-primary/20 hover:border-primary/40'
                }`}
              >
                <h3 className="text-3xl font-bold mb-4">باقة 6 أشهر</h3>
                <div className="flex items-center justify-center gap-4 mb-6">
                  <span className="text-5xl font-bold">125</span>
                  <div className="text-right">
                    <div className="text-gray-500 line-through">300 ألف د.ع</div>
                    <div className="text-primary font-medium">ألف د.ع / لـ 6 أشهر</div>
                  </div>
                </div>
                <div className="bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6 inline-block">
                  أرخص بنسبة 49% من الدفع الشهري
                </div>
                
                <ul className="space-y-4 mb-8 max-w-md mx-auto text-right">
                  <li className="text-gray-700">عدد الطلبات: غير محدود</li>
                  <li className="text-gray-700">عدد المنتجات: غير محدود</li>
                  <li className="text-gray-700">تحليل البيانات</li>
                  <li className="text-gray-700">إدارة الطلبات</li>
                  <li className="text-gray-700">دعم فني</li>
                  <li className="text-gray-700">عدد الأصناف غير محدود</li>
                  <li className="text-gray-700">شهادة حماية SSL</li>
                </ul>
                
                <Button 
                  size="lg" 
                  className="px-8 py-4 text-lg bg-gradient-to-r from-primary to-secondary"
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
          
          {/* Guarantee Section */}
          <div className="mt-12 text-center">
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 max-w-2xl mx-auto">
              <h4 className="text-lg font-bold text-green-800 mb-2">ضمان استرجاع الأموال</h4>
              <p className="text-green-700">
                إذا لم تكن راضياً، سنعيد لك كامل المبلغ خلال أول 7 أيام – بدون أي أسباب
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-8">
              <img src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png" alt="بداية" className="h-20 w-auto" />
            </div>
            <p className="text-gray-300 mb-10 max-w-lg mx-auto text-xl leading-relaxed">
              منصة شاملة لإنشاء وإدارة المتاجر الإلكترونية بكل سهولة واحترافية
            </p>
            <div className="text-base text-gray-400">
              جميع الحقوق محفوظة © 2025 نومو. منصة المتاجر الإلكترونية
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
