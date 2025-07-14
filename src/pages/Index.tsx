
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Star, Shield, Zap, Globe, BarChart3, Settings } from "lucide-react";
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
            <span className="text-gradient block"> للمتاجر الإلكترونية النامية</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed animate-fade-in">
            قم بتبسيط عملياتك التجارية مع منصتنا الشاملة للتجارة الإلكترونية. مصممة للشركات العصرية التي تقدر الكفاءة والامتثال والنمو القابل للتوسع.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8 animate-fade-in">
            <Link to="/builder">
              <Button size="lg" className="px-8 py-4 text-lg bg-primary hover:bg-primary/90 shadow-lg">
                ابدأ مجاناً
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="px-8 py-4 text-lg border-gray-300 hover:border-primary hover:text-primary">
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
            <h2 className="text-4xl md:text-5xl font-bold mb-6">كل ما يحتاجه عملك</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              حلول شاملة للتجارة الإلكترونية لتبسيط عملياتك التجارية ودفع نمو أعمالك
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-4">أتمتة إدارة المنتجات</h3>
              <p className="text-gray-600 leading-relaxed">
                أتمتة إدارة المخزون والمنتجات لتقليل الأخطاء اليدوية وتحسين الكفاءة في متجرك الإلكتروني.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-4">تحليلات في الوقت الفعلي</h3>
              <p className="text-gray-600 leading-relaxed">
                راقب الأداء المالي مع لوحات معلومات في الوقت الفعلي وتقارير شاملة.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-4">إدارة المخاطر</h3>
              <p className="text-gray-600 leading-relaxed">
                أدوات متقدمة لاكتشاف الاحتيال وتقييم المخاطر لحماية أعمالك التجارية.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Settings className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-4">أدوات الامتثال</h3>
              <p className="text-gray-600 leading-relaxed">
                ميزات امتثال مدمجة لتلبية المتطلبات التنظيمية بسهولة ودون عناء.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">أسعار شفافة لكل مرحلة</h2>
            <p className="text-xl text-gray-600">
              قم بتوسيع عملياتك التجارية مع خطط تنمو مع أعمالك
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border hover:shadow-lg transition-all duration-300">
              <h3 className="text-2xl font-bold mb-2">المبتدئ</h3>
              <div className="text-4xl font-bold mb-4">مجاني</div>
              <p className="text-gray-600 mb-6">مثالي للشركات الصغيرة التي تبدأ رحلتها في التجارة الإلكترونية</p>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>حتى 100 معاملة شهرياً</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>معالجة دفع أساسية</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>تقارير قياسية</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>دعم بالبريد الإلكتروني</span>
                </li>
              </ul>
              
              <Button className="w-full" variant="outline">ابدأ مجاناً</Button>
            </div>
            
            {/* Professional Plan */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-primary relative transform hover:scale-105 transition-all duration-300">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white px-4 py-2 rounded-full text-sm font-medium">
                الأكثر شعبية
              </div>
              <h3 className="text-2xl font-bold mb-2">المحترف</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold">99 ريال</span>
                <span className="text-gray-600">شهرياً</span>
              </div>
              <p className="text-gray-600 mb-6">مثالي للشركات النامية مع معاملات أكثر</p>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>حتى 10,000 معاملة شهرياً</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>معالجة دفع متقدمة</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>تحليلات في الوقت الفعلي</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>دعم متعدد العملات</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>حماية متقدمة من الاحتيال</span>
                </li>
              </ul>
              
              <Button className="w-full bg-primary hover:bg-primary/90">اختر المحترف</Button>
            </div>
            
            {/* Enterprise Plan */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border hover:shadow-lg transition-all duration-300">
              <h3 className="text-2xl font-bold mb-2">المؤسسات</h3>
              <div className="text-4xl font-bold mb-4">مخصص</div>
              <p className="text-gray-600 mb-6">للمؤسسات الكبيرة مع عمليات مالية معقدة</p>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>معاملات غير محدودة</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>سير عمل مخصص للمدفوعات</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>أدوات امتثال متقدمة</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>بنية تحتية مخصصة</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>دعم متميز 24/7</span>
                </li>
              </ul>
              
              <Button className="w-full" variant="outline">تواصل معنا</Button>
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
