
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
            <Link to="/builder">
              <Button size="sm" className="bg-primary hover:bg-primary/90">
                ابدأ مجاناً
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 lg:py-32">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-8 animate-fade-in">
            <Zap className="w-4 h-4" />
            إطلاق ميزات جديدة للتجارة الإلكترونية
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight animate-fade-in">
            أنشئ متجرك الإلكتروني خلال دقائق،
            <span className="text-gradient block bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"> وابدأ البيع اليوم</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed animate-fade-in">
            منصة متكاملة تساعدك على بناء، إدارة، وتطوير متجرك بكل سهولة — بدون أي خبرة تقنية.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">كل ما يحتاجه متجرك في مكان واحد</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              من إدارة الطلبات إلى تحليل بيانات العملاء — كل الأدوات التي تحتاجها لبناء متجرك وتنميته
            </p>
            <p className="text-lg text-gray-500 mt-4 max-w-4xl mx-auto">
              حلول متكاملة لإدارة عملياتك، وتحليل أدائك، وتحقيق نموك بثقة
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-4">إدارة منتجات ذكية وسهلة</h3>
              <p className="text-gray-600 leading-relaxed">
                نظّم مخزونك وتابع منتجاتك بخطوات بسيطة. قل وداعًا للأخطاء اليدوية، ومرحبًا بالكفاءة.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-4">تحليلات لحظية تقود قراراتك</h3>
              <p className="text-gray-600 leading-relaxed">
                لوحات بيانات تفاعلية تُمكِّنك من تتبع الأداء المالي والتشغيلي في الوقت الفعلي، لتصنع قرارات مدروسة بثقة.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-4">راحة بالك تبدأ من هنا</h3>
              <p className="text-gray-600 leading-relaxed">
                بياناتك وبيانات عملائك في أيدٍ أمينة – مع نظام حماية متكامل
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Palette className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-4">تصميم متجرك في دقائق بدون برمجة أو تعقيد</h3>
              <p className="text-gray-600 leading-relaxed">
                صمّم متجرك بنفسك دون أي خبرة تقنية واجهة سهلة وبسيطة يمنحك تحكمًا كاملاً بتصميم متجرك
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Headphones className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-4">دعم فني حقيقي وشخصي</h3>
              <p className="text-gray-600 leading-relaxed">
                فريق دعم متجاوب وسريع يساعدك خطوة بخطوة في رحلتك التجارية
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-4">تابع أداء متجرك لحظة بلحظة</h3>
              <p className="text-gray-600 leading-relaxed">
                تحليلات حيّة ولوحات بيانات تساعدك على اتخاذ قرارات ذكية بثقة
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">خطط تسعير واضحة، تناسب كل مرحلة من نموك</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
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
                سنوي
              </button>
            </div>
          </div>
          
          {/* Monthly Plans */}
          {billingType === 'monthly' && (
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* Beginner Plan */}
              <div 
                onClick={() => setSelectedPlan('beginner')}
                className={`bg-white rounded-2xl p-8 shadow-sm border-2 hover:shadow-lg transition-all duration-300 cursor-pointer ${
                  selectedPlan === 'beginner' 
                    ? 'border-primary ring-2 ring-primary/20' 
                    : 'border-gray-200 hover:border-primary/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <div className="w-4 h-4 bg-blue-500 rounded-sm"></div>
                  </div>
                  <h3 className="text-2xl font-bold">باقة المبتدئين</h3>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-bold">$19</span>
                  <span className="text-gray-600">/ شهرياً</span>
                </div>
                
                 <ul className="space-y-4 mb-8 text-right">
                  <li className="text-gray-700">عدد الطلبات: 50 شهرياً</li>
                  <li className="text-gray-700">عدد المنتجات: 25</li>
                  <li className="text-gray-500">تحليل البيانات</li>
                  <li className="text-gray-700">إدارة الطلبات</li>
                  <li className="text-gray-700">دعم فني</li>
                  <li className="text-gray-700">عدد الأصناف غير محدود</li>
                  <li className="text-gray-700">شهادة حماية SSL</li>
                </ul>
                
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/signup', { state: { selectedPlan: { id: 'beginner', name: 'باقة المبتدئين', price: '$19' } } });
                  }}
                >
                  ابدأ الآن
                </Button>
              </div>
              
              {/* Professional Plan */}
               <div 
                onClick={() => setSelectedPlan('professional')}
                className={`bg-white rounded-2xl p-8 shadow-lg border-2 relative transition-all duration-300 cursor-pointer ${
                  selectedPlan === 'professional' 
                    ? 'border-primary ring-2 ring-primary/20' 
                    : selectedPlan === null 
                      ? 'border-primary hover:border-primary/80 transform hover:scale-105'
                      : 'border-gray-200 hover:border-primary/30'
                }`}
               >
                {(selectedPlan === null || selectedPlan === 'professional') && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white px-4 py-2 rounded-full text-sm font-medium">
                    الأكثر شعبية
                  </div>
                )}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <div className="w-4 h-4 bg-primary rounded-sm"></div>
                  </div>
                  <h3 className="text-2xl font-bold">باقة المحترفين</h3>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-bold">$35</span>
                  <span className="text-gray-600">/ شهرياً</span>
                </div>
                
                <ul className="space-y-4 mb-8 text-right">
                  <li className="text-gray-700">عدد الطلبات: 150 شهرياً</li>
                  <li className="text-gray-700">عدد المنتجات: 75</li>
                  <li className="text-gray-700">تحليل البيانات</li>
                  <li className="text-gray-700">إدارة الطلبات</li>
                  <li className="text-gray-700">دعم فني</li>
                  <li className="text-gray-700">عدد الأصناف غير محدود</li>
                  <li className="text-gray-700">شهادة حماية SSL</li>
                </ul>
                
                <Button 
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/signup', { state: { selectedPlan: { id: 'professional', name: 'باقة المحترفين', price: '$35' } } });
                  }}
                >
                  ابدأ الآن
                </Button>
              </div>
              
              {/* Elite Plan */}
              <div 
                onClick={() => setSelectedPlan('elite')}
                className={`bg-white rounded-2xl p-8 shadow-sm border-2 hover:shadow-lg transition-all duration-300 cursor-pointer ${
                  selectedPlan === 'elite' 
                    ? 'border-primary ring-2 ring-primary/20' 
                    : 'border-gray-200 hover:border-primary/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <div className="w-4 h-4 bg-amber-500 rounded-sm"></div>
                  </div>
                  <h3 className="text-2xl font-bold">باقة النخبة</h3>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-bold">$49</span>
                  <span className="text-gray-600">/ شهرياً</span>
                </div>
                
                <ul className="space-y-4 mb-8 text-right">
                  <li className="text-gray-700">عدد الطلبات: غير محدود</li>
                  <li className="text-gray-700">عدد المنتجات: غير محدود</li>
                  <li className="text-gray-700">تحليل البيانات</li>
                  <li className="text-gray-700">إدارة الطلبات</li>
                  <li className="text-gray-700">دعم فني</li>
                  <li className="text-gray-700">عدد الأصناف غير محدود</li>
                  <li className="text-gray-700">شهادة حماية SSL</li>
                </ul>
                
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/signup', { state: { selectedPlan: { id: 'elite', name: 'باقة النخبة', price: '$49' } } });
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
                <h3 className="text-3xl font-bold mb-4">الباقة السنوية</h3>
                <div className="flex items-center justify-center gap-4 mb-6">
                  <span className="text-5xl font-bold">$299</span>
                  <div className="text-right">
                    <div className="text-gray-500 line-through">$588</div>
                    <div className="text-primary font-medium">/ سنوياً</div>
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
                    navigate('/signup', { state: { selectedPlan: { id: 'annual', name: 'الباقة السنوية', price: '$299' } } });
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

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">الأسئلة الشائعة</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              كل ما تحتاج معرفته عن باقاتنا ومنصتنا
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto space-y-8">
            {/* FAQ Item 1 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <h3 className="text-2xl font-bold mb-4 text-primary">❓ ما المقصود بـ عدد الطلبات؟</h3>
              <p className="text-gray-700 mb-4 leading-relaxed">
                هو الحد الأقصى المسموح به للطلبات التي يمكن لمتجرك استقبالها شهرياً ضمن الباقة الحالية.
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-green-800 font-medium">
                  ✅ إذا تجاوزت هذا الحد، سيستمر متجرك باستقبال الطلبات بشكل طبيعي، لكن لا يمكن تجديد الاشتراك أو الاستمرار في نفس الباقة بعد انتهائها، إلا من خلال الترقية إلى باقة أعلى تناسب حجم مبيعاتك المتزايد.
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800">
                  💡 هدفنا أن لا نعيق نمو متجرك، بل نمنحك المرونة لتتوسع أولاً، ثم تقرر الترقية لاحقاً بكل سهولة.
                </p>
              </div>
            </div>
            
            {/* FAQ Item 2 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <h3 className="text-2xl font-bold mb-4 text-primary">❓ ما معنى عدد المنتجات؟</h3>
              <p className="text-gray-700 mb-4 leading-relaxed">
                هو الحد الأقصى لعدد المنتجات المختلفة التي يمكنك عرضها في متجرك.
              </p>
              <p className="text-gray-700 mb-4 leading-relaxed">
                مثلاً، إذا كانت الباقة تدعم 75 منتجاً، فيمكنك عرض 75 صنفاً مختلفاً.
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-green-800 font-medium">
                  ✅ بإمكانك داخل كل منتج إضافة خيارات متعددة (مثل القياسات، الألوان، الأحجام) دون أن يُحسب كمنتج إضافي – يظل منتجاً واحداً مهما اختلفت نسخه.
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">
                  🚫 عند الوصول للحد الأقصى، لن تتمكن من إضافة منتجات جديدة إلا بعد حذف منتج قديم أو ترقية الباقة لعدد أكبر من المنتجات.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <img src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png" alt="بداية" className="h-16 w-auto" />
            </div>
            <p className="text-gray-400 mb-8 max-w-md mx-auto text-lg">
              منصة شاملة لإنشاء وإدارة المتاجر الإلكترونية بكل سهولة واحترافية
            </p>
            <div className="text-sm text-gray-500">
              جميع الحقوق محفوظة © 2025 نومو. منصة المتاجر الإلكترونية
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
