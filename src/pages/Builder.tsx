

import { Link } from "react-router-dom";

import {

  Plus,

  Settings,

  BarChart3,

  Copy,

  Check,

  Package,

  Archive,

  TrendingUp,

  ShoppingBag,

  ChevronLeft,

} from "lucide-react";

import { Button } from "@/components/ui/button";

import { useAuth } from "@/context/AuthContext";

import { useState } from "react";

import { toast } from "sonner";

import { copyStorePublicUrl } from "@/lib/storeUrl";

import DashboardOverview from "@/components/dashboard/DashboardOverview";

import StoreIdentityHeader from "@/components/dashboard/StoreIdentityHeader";

import { usePreloadData } from "@/hooks/usePreloadData";

import DashboardLayout from "@/components/layout/DashboardLayout";

import { cn } from "@/lib/utils";



const dashboardCards = [

  {

    to: "/orders",

    icon: ShoppingBag,

    label: "الطلبات",

    desc: "متابعة ومعالجة الطلبات",

    iconBg: "bg-blue-500/10",

    iconColor: "text-blue-600 dark:text-blue-400",

    ring: "ring-blue-500/15 group-hover:ring-blue-500/30",

  },

  {

    to: "/products",

    icon: Package,

    label: "المنتجات",

    desc: "إضافة وتعديل المنتجات",

    iconBg: "bg-primary/10",

    iconColor: "text-primary",

    ring: "ring-primary/15 group-hover:ring-primary/30",

  },

  {

    to: "/statistics",

    icon: BarChart3,

    label: "الإحصائيات",

    desc: "تقارير وأداء المتجر",

    iconBg: "bg-violet-500/10",

    iconColor: "text-violet-600 dark:text-violet-400",

    ring: "ring-violet-500/15 group-hover:ring-violet-500/30",

  },

  {

    to: "/marketing",

    icon: TrendingUp,

    label: "التسويق",

    desc: "كوبونات وإعلانات",

    iconBg: "bg-emerald-500/10",

    iconColor: "text-emerald-600 dark:text-emerald-400",

    ring: "ring-emerald-500/15 group-hover:ring-emerald-500/30",

  },

  {

    to: "/inventory",

    icon: Archive,

    label: "المخزون",

    desc: "كميات وتوفر المنتجات",

    iconBg: "bg-teal-500/10",

    iconColor: "text-teal-600 dark:text-teal-400",

    ring: "ring-teal-500/15 group-hover:ring-teal-500/30",

  },

  {

    to: "/settings",

    icon: Settings,

    label: "الإعدادات",

    desc: "مظهر المتجر وطرق الدفع",

    iconBg: "bg-slate-500/10",

    iconColor: "text-slate-600 dark:text-slate-400",

    ring: "ring-slate-500/15 group-hover:ring-slate-500/30",

  },

];



export default function Builder() {

  const { user } = useAuth();

  const [copied, setCopied] = useState(false);



  usePreloadData();



  const handleCopyLink = async () => {

    if (!user?.id) return;

    try {

      const url = await copyStorePublicUrl(user.id);

      if (!url) {

        toast.error("حدّد رابط المتجر (slug) من الإعدادات أولاً");

        return;

      }

      setCopied(true);

      toast.success("تم نسخ الرابط — شاركه مع عملائك الآن!");

      setTimeout(() => setCopied(false), 2000);

    } catch {

      toast.error("فشل في نسخ الرابط");

    }

  };



  return (

    <DashboardLayout isHome>

      <div className="ds-page max-w-5xl">

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-2">

          <StoreIdentityHeader />

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



        <DashboardOverview />



        <div>

          <h3 className="ds-section-title mb-3 px-1">الوصول السريع</h3>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">

            {dashboardCards.map((card, i) => {

              const Icon = card.icon;

              return (

                <Link key={card.to} to={card.to} className="group block h-full" dir="rtl">

                  <div

                    className={cn(

                      "relative h-full overflow-hidden rounded-2xl border border-border/50 bg-card p-4 sm:p-5",

                      "transition-all duration-200 hover:border-primary/20 hover:shadow-md hover:shadow-primary/[0.04]",

                      "animate-fade-in"

                    )}

                    style={{ animationDelay: `${i * 40}ms` }}

                  >

                    <div className="flex items-start justify-between gap-2">

                      <div

                        className={cn(

                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-all",

                          card.iconBg,

                          card.ring

                        )}

                      >

                        <Icon className={cn("h-[18px] w-[18px]", card.iconColor)} strokeWidth={2} />

                      </div>

                      <ChevronLeft

                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/30 transition-all group-hover:text-primary/70 group-hover:-translate-x-0.5"

                        strokeWidth={2}

                      />

                    </div>

                    <div className="mt-3 text-right">

                      <h3 className="text-sm font-semibold text-foreground leading-snug">{card.label}</h3>

                      <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground leading-relaxed line-clamp-2">

                        {card.desc}

                      </p>

                    </div>

                  </div>

                </Link>

              );

            })}

          </div>

        </div>

      </div>

    </DashboardLayout>

  );

}


