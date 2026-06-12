import { lazy, Suspense } from "react";
import { Gift, Tag, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/layout/PageHeader";

const CouponsTab = lazy(() => import("@/components/marketing/CouponsTab"));
const ProductDiscountsTab = lazy(() => import("@/components/marketing/ProductDiscountsTab"));
const MarketingSettingsTab = lazy(() => import("@/components/marketing/MarketingSettingsTab"));

const TabFallback = () => (
  <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
    <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin ml-2" />
    جاري التحميل...
  </div>
);

const Marketing = () => {
  return (
    <DashboardLayout>
      <PageHeader
        title="التسويق والعروض"
        description="كوبونات الخصم، عروض المنتجات، وإعدادات التسويق"
        hideBack
        breadcrumbs={[{ label: 'لوحة التحكم', href: '/builder' }, { label: 'التسويق' }]}
      />

      <div className="ds-page max-w-6xl">
        <Tabs defaultValue="coupons" className="space-y-5">
          <TabsList className="grid w-full grid-cols-3 rounded-xl bg-muted/50 p-1 h-auto">
            <TabsTrigger value="coupons" className="flex items-center gap-1.5 rounded-lg text-xs sm:text-sm min-h-[44px] data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Gift className="w-4 h-4" />
              <span className="hidden sm:inline">كوبونات الخصم</span>
              <span className="sm:hidden">كوبونات</span>
            </TabsTrigger>
            <TabsTrigger value="product-discounts" className="flex items-center gap-1.5 rounded-lg text-xs sm:text-sm min-h-[44px] data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Tag className="w-4 h-4" />
              <span className="hidden sm:inline">خصومات المنتجات</span>
              <span className="sm:hidden">خصومات</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1.5 rounded-lg text-xs sm:text-sm min-h-[44px] data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">إعدادات التسويق</span>
              <span className="sm:hidden">إعدادات</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="coupons">
            <Suspense fallback={<TabFallback />}>
              <CouponsTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="product-discounts">
            <Suspense fallback={<TabFallback />}>
              <ProductDiscountsTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="settings">
            <Suspense fallback={<TabFallback />}>
              <MarketingSettingsTab />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Marketing;
