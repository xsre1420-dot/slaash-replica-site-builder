
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Star, Shield, Zap, Globe, BarChart3, Settings, Package, TrendingUp, Lock, Palette, Headphones, Users } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-white font-arabic" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-sm"></div>
            </div>
            <span className="font-bold text-xl">نومو</span>
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
            حلول تجارية شاملة
            <span className="text-gradient block bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"> للمتاجر الإلكترونية النامية</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed animate-fade-in">
            قم بتبسيط عملياتك التجارية مع منصتنا الشاملة للتجارة الإلكترونية. مصممة للشركات العصرية التي تقدر الكفاءة والامتثال والنمو القابل للتوسع.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8 animate-fade-in">
            <Link to="/builder">
              <Button size="lg" className="px-8 py-4 text-lg bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
                ابدأ مجاناً
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="px-8 py-4 text-lg border-primary/30 text-primary hover:border-primary hover:bg-primary/5 transition-all duration-300">
              احجز عرضاً تجريبياً
            </Button>
          </div>
          
          <p className="text-sm text-gray-500 animate-fade-in">
            لا حاجة لبطاقة ائتمان • نسخة تجريبية مجانية لمدة 14 يوماً
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
          
          {/* Monthly Plans Toggle */}
          <div className="flex justify-center mb-12">
            <div className="bg-gray-100 rounded-xl p-1 flex">
              <button className="px-6 py-2 bg-white rounded-lg shadow-sm font-medium">شهري</button>
              <button className="px-6 py-2 text-gray-500 font-medium">سنوي</button>
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Beginner Plan */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <div className="w-4 h-4 bg-blue-500 rounded-sm"></div>
                </div>
                <h3 className="text-2xl font-bold">باقة المبتدئ</h3>
              </div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold">$19</span>
                <span className="text-gray-600">/ شهرياً</span>
              </div>
              <p className="text-gray-600 mb-6">مثالي للمتاجر الناشئة</p>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>50 طلب شهرياً</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>25 منتج</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>تصميم أساسي للمتجر</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>دعم بالبريد الإلكتروني</span>
                </li>
              </ul>
              
              <Button className="w-full" variant="outline">ابدأ مجاناً</Button>
              <p className="text-xs text-gray-500 text-center mt-3">
                يمكنك تجاوز الحد مؤقتاً، ولكن يلزم الترقية عند انتهاء الاشتراك
              </p>
            </div>
            
            {/* Professional Plan */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-primary relative transform hover:scale-105 transition-all duration-300">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white px-4 py-2 rounded-full text-sm font-medium">
                الأكثر شعبية
              </div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <div className="w-4 h-4 bg-primary rounded-sm"></div>
                </div>
                <h3 className="text-2xl font-bold">باقة المحترف</h3>
              </div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold">$35</span>
                <span className="text-gray-600">/ شهرياً</span>
              </div>
              <p className="text-gray-600 mb-6">للمتاجر النامية والمحترفة</p>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>150 طلب شهرياً</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>75 منتج</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>تصميم متقدم للمتجر</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>تحليلات مفصلة</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>دعم ذو أولوية</span>
                </li>
              </ul>
              
              <Button className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 transition-all duration-300 transform hover:scale-[1.02]">اختر المحترف</Button>
              <p className="text-xs text-gray-500 text-center mt-3">
                يمكنك تجاوز الحد مؤقتاً، ولكن يلزم الترقية عند انتهاء الاشتراك
              </p>
            </div>
            
            {/* Elite Plan */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border hover:shadow-lg transition-all duration-300">
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
              <p className="text-gray-600 mb-6">للمتاجر الكبيرة والمؤسسات</p>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>طلبات غير محدودة</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>منتجات غير محدودة</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>تصميم متميز وشخصي</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>تحليلات متقدمة</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>دعم فني 24/7</span>
                </li>
              </ul>
              
              <Button className="w-full" variant="outline">اختر النخبة</Button>
            </div>
          </div>
          
          {/* Annual Plan Section */}
          <div className="mt-16 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-3xl p-8 text-center">
            <h3 className="text-3xl font-bold mb-4">الباقة السنوية - وفر 49%</h3>
            <div className="flex items-center justify-center gap-4 mb-6">
              <span className="text-5xl font-bold">$299</span>
              <div className="text-right">
                <div className="text-gray-500 line-through">$588</div>
                <div className="text-primary font-medium">/ سنوياً</div>
              </div>
            </div>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              كل الميزات غير المحدودة، بدفعة واحدة سنوياً. اقتصادية ومريحة لنمو متجرك
            </p>
            <Button size="lg" className="px-8 py-4 text-lg bg-gradient-to-r from-primary to-secondary">
              احصل على الباقة السنوية
            </Button>
          </div>
          
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
      <footer className="bg-gray-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <div className="w-4 h-4 bg-white rounded-sm"></div>
              </div>
              <span className="font-bold text-xl">نومو</span>
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
