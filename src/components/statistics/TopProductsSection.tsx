
import { Award } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface TopProductsSectionProps {
  topProducts: Array<{
    name: string;
    orders: number;
    revenue: number;
    percentage: number;
  }>;
}

export const TopProductsSection = ({ topProducts }: TopProductsSectionProps) => {
  return (
    <div className="animate-fade-in" style={{ animationDelay: '250ms' }}>
      <Card className="border border-border shadow-sm rounded-2xl bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-right text-foreground text-base flex items-center gap-2 justify-end">
            <span>أفضل المنتجات مبيعاً</span>
            <Award className="w-5 h-5 text-primary" />
          </CardTitle>
          <CardDescription className="text-right">المنتجات الأكثر طلباً مع النسب المئوية</CardDescription>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              لا توجد منتجات لعرضها
            </div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={product.name} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{product.orders} طلب</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
                        {product.percentage.toFixed(0)}%
                      </span>
                    </div>
                    <span className="text-sm font-medium text-green-600">{product.revenue.toLocaleString()} د.ع</span>
                  </div>
                  <div className="text-right">
                    <h4 className="font-medium text-foreground text-sm">{product.name}</h4>
                    <span className="text-xs text-primary">المرتبة #{index + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
