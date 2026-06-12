
import { Link } from "react-router-dom";
import { List, Plus, Settings, BarChart3, Copy, Check, Package, Archive, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import platformLogo from "@/assets/platform-logo.png";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { usePreloadData } from "@/hooks/usePreloadData";
import { getProductsSync } from "@/services/productService";
import DashboardLayout from "@/components/layout/DashboardLayout";

const dashboardCards = [
  { to: "/orders", icon: List, label: "الطلبات", desc: "إدارة الطلبات" },
  { to: "/products", icon: Package, label: "المنتجات", desc: "إدارة المنتجات" },
  { to: "/settings", icon: Settings, label: "الإعدادات", desc: "إعدادات المتجر" },
  { to: "/statistics", icon: BarChart3, label: "الإحصائيات", desc: "تقارير وإحصاءات" },
  { to: "/marketing", icon: TrendingUp, label: "التسويق", desc: "كوبونات وإعلانات" },
  { to: "/inventory", icon: Archive, label: "المخزون", desc: "إدارة المخزون" },
];

export default function Builder() {
  const { storeName } = useStore();
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
    if (storeName && storeName !== 'متجري') steps.push('settings');
    if (localStorage.getItem('store_shared')) steps.push('share');
    setCompletedSteps(steps);
  }, [storeName]);

  const handleCopyLink = async () => {
    if (user) {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/store/${user.username}`);
        setCopied(true);
        localStorage.setItem('store_shared', 'true');
        toast.success("تم نسخ الرابط بنجاح!");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("فشل في نسخ الرابط");
      }
    }
  };

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
          />
        )}

        <div className="ds-card p-6 sm:p-8 text-center shadow-brand animate-fade-in">
          <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-5">
            <img src={platformLogo} alt="بداية" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-1">{storeName || 'متجري'}</h2>
          <p className="text-sm text-muted-foreground mb-6">لوحة تحكم متجرك — كل شيء في مكان واحد</p>

          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <Button
              size="lg"
              variant={copied ? 'default' : 'outline'}
              className={`flex-1 rounded-xl min-h-[48px] ${copied ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600' : ''}`}
              onClick={handleCopyLink}
            >
              {copied ? <><Check className="w-4 h-4" />تم النسخ</> : <><Copy className="w-4 h-4" />نسخ رابط المتجر</>}
            </Button>
            <Link to="/add-product" className="flex-1">
              <Button size="lg" className="w-full rounded-xl min-h-[48px] shadow-brand">
                <Plus className="w-4 h-4" />
                إضافة منتج
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {dashboardCards.map((card, i) => (
            <Link key={card.to} to={card.to} className="group">
              <div className="ds-card card-hover p-5 sm:p-6 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <card.icon className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <h3 className="font-bold text-foreground text-sm sm:text-base mb-0.5">{card.label}</h3>
                <p className="text-xs text-muted-foreground">{card.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
