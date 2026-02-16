
import { Link } from "react-router-dom";
import { Eye, List, Plus, Settings, BarChart3, Copy, Check, Package, Archive, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import StoreHeader from "@/components/StoreHeader";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { toast } from "sonner";
import platformLogo from "@/assets/platform-logo.png";
import { ThemeToggle } from "@/components/ThemeToggle";

const dashboardCards = [
  { to: "/orders", icon: List, label: "الطلبات", desc: "إدارة الطلبات", gradient: "from-primary to-secondary" },
  { to: "/products", icon: Package, label: "المنتجات", desc: "إدارة المنتجات", gradient: "from-amber-500 to-orange-500" },
  { to: "/settings", icon: Settings, label: "الإعدادات", desc: "إعدادات المتجر", gradient: "from-cyan-500 to-teal-500" },
  { to: "/statistics", icon: BarChart3, label: "الإحصائيات", desc: "تقارير وإحصاءات", gradient: "from-blue-500 to-indigo-600" },
  { to: "/marketing", icon: TrendingUp, label: "التسويق", desc: "كوبونات وإعلانات", gradient: "from-pink-500 to-rose-500" },
  { to: "/inventory", icon: Archive, label: "المخزون", desc: "إدارة المخزون", gradient: "from-emerald-500 to-green-600" },
];

export default function Builder() {
  const { storeName, storeLogo, updateStore } = useStore();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  return (
    <div className="min-h-screen bg-background font-arabic">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-2">
          <ThemeToggle />
          <StoreHeader 
            storeName={storeName} 
            storeLogo={storeLogo} 
            onUpdateStore={updateStore} 
          />
        </div>
      </div>
      
      {/* Main Content */}
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        {/* Store Link Card */}
        <div className="bg-card rounded-3xl p-6 sm:p-8 mb-6 max-w-3xl mx-auto border border-border/50 shadow-sm animate-fade-in">
          <div className="text-center mb-6">
            <div className="w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center mx-auto">
              <img src={platformLogo} alt="بيلانة" className="w-full h-full object-contain" />
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-3 max-w-xl mx-auto">
            <Button 
              size="lg"
              className={`w-full transition-all duration-300 rounded-2xl px-6 py-5 text-sm sm:text-base shadow-sm ${
                copied 
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                  : 'bg-card hover:bg-muted text-foreground border border-border hover:border-primary/40'
              }`}
              onClick={async () => {
                if (user) {
                  try {
                    await navigator.clipboard.writeText(`${window.location.origin}/store/${user.username}`);
                    setCopied(true);
                    toast.success("تم نسخ الرابط بنجاح!");
                    setTimeout(() => setCopied(false), 2000);
                  } catch (error) {
                    toast.error("فشل في نسخ الرابط");
                  }
                }
              }}
            >
              {copied ? (
                <><Check className="w-4 h-4 ml-2" />تم النسخ بنجاح</>
              ) : (
                <><Copy className="w-4 h-4 ml-2" />نسخ رابط المتجر</>
              )}
            </Button>
            
            <div className="grid grid-cols-2 gap-3 w-full">
              <Link to="/preview" className="w-full">
                <Button variant="outline" className="w-full h-12 text-sm bg-card hover:bg-muted text-foreground border-border hover:border-primary/40 rounded-2xl transition-all">
                  <Eye className="w-4 h-4 ml-2" />
                  معاينة المتجر
                </Button>
              </Link>
              <Link to="/add-product" className="w-full">
                <Button className="w-full h-12 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl shadow-md transition-all">
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة منتج
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-24 md:mb-8">
          {dashboardCards.map((card, i) => (
            <Link key={card.to} to={card.to} className="group">
              <div 
                className="bg-card p-5 sm:p-6 rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group-hover:-translate-y-1 animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-3 sm:mb-4 shadow-sm`}>
                  <card.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <h3 className="font-bold text-foreground text-sm sm:text-base mb-0.5">{card.label}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{card.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
