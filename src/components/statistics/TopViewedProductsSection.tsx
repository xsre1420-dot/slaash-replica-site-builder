
import { Eye } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export interface TopViewedProduct {
  productId: string;
  name: string;
  views: number;
  percentage: number;
}

interface TopViewedProductsSectionProps {
  topViewedProducts: TopViewedProduct[];
}

export const TopViewedProductsSection = ({ topViewedProducts }: TopViewedProductsSectionProps) => {
  return (
    <div className="animate-fade-in mb-8" style={{ animationDelay: '200ms' }}>
      <Card className="border border-border shadow-sm rounded-2xl bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-right text-foreground text-base flex items-center gap-2 justify-end">
            <span>المنتجات الأكثر مشاهدة</span>
            <Eye className="w-5 h-5 text-primary" />
          </CardTitle>
          <CardDescription className="text-right">عدد مرات عرض صفحة المنتج في المتجر</CardDescription>
        </CardHeader>
        <CardContent>
          {topViewedProducts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              لا توجد مشاهدات منتجات في هذه الفترة
            </div>
          ) : (
            <div className="space-y-3">
              {topViewedProducts.map((product, index) => (
                <div
                  key={product.productId}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="text-right">
                    <span className="text-sm font-medium text-foreground">{product.views.toLocaleString()} مشاهدة</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium mr-2">
                      {product.percentage.toFixed(0)}%
                    </span>
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
