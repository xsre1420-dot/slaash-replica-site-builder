import { Link } from "react-router-dom";
import { ArrowRight, Gift, Tag, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CouponsTab from "@/components/marketing/CouponsTab";
import ProductDiscountsTab from "@/components/marketing/ProductDiscountsTab";
import MarketingSettingsTab from "@/components/marketing/MarketingSettingsTab";

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
            <CouponsTab />
          </TabsContent>

          <TabsContent value="product-discounts">
            <ProductDiscountsTab />
          </TabsContent>

          <TabsContent value="settings">
            <MarketingSettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Marketing;
