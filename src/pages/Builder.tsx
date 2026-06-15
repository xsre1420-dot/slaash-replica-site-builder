
import { Link } from "react-router-dom";
import { List, Plus, Settings, BarChart3, Copy, Check, Package, Archive, TrendingUp, Sparkles, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { copyStorePublicUrl } from "@/lib/storeUrl";
import platformLogo from "@/assets/platform-logo.png";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import { usePreloadData } from "@/hooks/usePreloadData";
import { getProductsSync } from "@/services/productService";
import DashboardLayout from "@/components/layout/DashboardLayout";

const dashboardCards = [
  { to: "/orders", icon: List, label: "الطلبات", desc: "إدارة الطلبات", color: "bg-blue-500/10 text-blue-600" },
  { to: "/products", icon: Package, label: "المنتجات", desc: "إدارة المنتجات", color: "bg-primary/10 text-primary" },
  { to: "/settings", icon: Settings, label: "الإعدادات", desc: "إعدادات المتجر", color: "bg-slate-500/10 text-slate-600" },
  { to: "/statistics", icon: BarChart3, label: "الإحصائيات", desc: "تقارير وإحصاءات", color: "bg-violet-500/10 text-violet-600" },
  { to: "/marketing", icon: TrendingUp, label: "التسويق", desc: "كوبونات وإعلانات", color: "bg-emerald-500/10 text-emerald-600" },
  { to: "/inventory", icon: Archive, label: "المخزون", desc: "إدارة المخزون", color: "bg-amber-500/10 text-amber-600" },
];

export default function Builder() {
  const { storeName, storeLogo } = useStore();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  usePreloadData();

  useEffect(() => {
    const dismissed = localStorage.getItem('onboarding_dismissed');
    if (dismissed) setShowOnboarding(false);

    const steps: string[] = [];
    if (getProductsSync().length > 0) steps.push('add-product');
    if (storeLogo || (storeName && storeName !== 'متجري')) steps.push('settings');
    if (localStorage.getItem('store_shared')) steps.push('share');
    setCompletedSteps(steps);
  }, [storeName, storeLogo]);

  const handleCopyLink = async () => {
    if (!user?.id) return;
    try {
      const url = await copyStorePublicUrl(user.id, user.username);
      if (!url) {
        toast.error("حدّد رابط المتجر (slug) من الإعدادات أولاً");
        return;
      }
      setCopied(true);
      localStorage.setItem('store_shared', 'true');
      setCompletedSteps((prev) => (prev.includes('share') ? prev : [...prev, 'share']));
      toast.success("تم نسخ الرابط — شاركه مع عملائك الآن!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("فشل في نسخ الرابط");
    }
  };

  const totalSteps = 3;
  const onboardingComplete = completedSteps.length >= totalSteps;

  return (
    <DashboardLayout isHome>
      <div className="ds-page max-w-5xl">
        {showOnboarding && (
          <OnboardingChecklist
            completedSteps={completedSteps}
            onDismiss={() => {
              setShowOnboarding(false);
              localStorage.setItem('onboarding_dismissed', 'true');
            }}
            onCopyLink={handleCopyLink}
          />
        )}

        {!showOnboarding && !onboardingComplete && (
          <div className="flex justify-end mb-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-primary rounded-xl gap-1.5"
              onClick={() => {
                setShowOnboarding(true);
                localStorage.removeItem('onboarding_dismissed');
              }}
            >
              <BookOpen className="w-3.5 h-3.5" />
              إظهار دليل الإعداد
            </Button>
          </div>
        )}

        {/* Compact store header with primary actions */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-2">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center shrink-0 overflow-hidden">
              {storeLogo ? (
                <img src={storeLogo} alt="" className="w-full h-full object-cover" />
              ) : (
                <img src={platformLogo} alt="بداية" className="w-9 h-9 object-contain" />
              )}
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-xs text-primary font-medium mb-0.5">
                <Sparkles className="w-3.5 h-3.5" />
                لوحة التحكم
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">
                {storeName || 'متجري'}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">مرحباً — إليك ملخص متجرك اليوم</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant={copied ? 'default' : 'outline'}
              className={`rounded-xl min-h-[44px] flex-1 sm:flex-none ${copied ? 'bg-success hover:bg-success/90 border-success' : ''}`}
              onClick={handleCopyLink}
            >
              {copied ? <><Check className="w-4 h-4" />تم النسخ</> : <><Copy className="w-4 h-4" />نسخ الرابط</>}
            </Button>
            <Link to="/add-product">
              <Button className="rounded-xl min-h-[44px]">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">إضافة منتج</span>
                <span className="sm:hidden">منتج</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Store overview — stats + recent activity */}
        <DashboardOverview />

        {/* Quick access */}
        <div>
          <h3 className="ds-section-title mb-4 px-1">الوصول السريع</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {dashboardCards.map((card, i) => (
              <Link key={card.to} to={card.to} className="group">
                <div
                  className="ds-card card-hover p-5 sm:p-6 animate-fade-in h-full"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-105 ${card.color}`}>
                    <card.icon className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm sm:text-base mb-1">{card.label}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{card.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
