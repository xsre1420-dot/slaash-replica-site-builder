import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Gift, Tag, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CouponsTab = lazy(() => import("@/components/marketing/CouponsTab"));
const ProductDiscountsTab = lazy(() => import("@/components/marketing/ProductDiscountsTab"));
const MarketingSettingsTab = lazy(() => import("@/components/marketing/MarketingSettingsTab"));

const TabFallback = () => (
  <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">جاري التحميل...</div>
);

const Marketing = () => {
  return (
    <div className="min-h-screen bg-background font-arabic">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="w-10" />
            <h1 className="text-xl font-bold text-foreground">التسويق والعروض</h1>
            <Link to="/builder">
              <Button variant="ghost" size="icon" className="rounded-xl">
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <Tabs defaultValue="coupons" className="space-y-5">
          <TabsList className="grid w-full grid-cols-3 rounded-xl bg-muted/50 p-1">
            <TabsTrigger value="coupons" className="flex items-center gap-1.5 rounded-lg text-xs sm:text-sm">
              <Gift className="w-4 h-4" />
              <span className="hidden sm:inline">كوبونات الخصم</span>
              <span className="sm:hidden">كوبونات</span>
            </TabsTrigger>
            <TabsTrigger value="product-discounts" className="flex items-center gap-1.5 rounded-lg text-xs sm:text-sm">
              <Tag className="w-4 h-4" />
              <span className="hidden sm:inline">خصومات المنتجات</span>
              <span className="sm:hidden">خصومات</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1.5 rounded-lg text-xs sm:text-sm">
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
    </div>
  );
};

export default Marketing;
