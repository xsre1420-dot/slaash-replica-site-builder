
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
    <Card className="border-0 shadow-sm rounded-3xl">
      <CardHeader>
        <CardTitle className="text-right">أفضل المنتجات مبيعاً</CardTitle>
        <CardDescription className="text-right">المنتجات الأكثر طلباً مع النسب المئوية</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topProducts.map((product, index) => (
            <div key={product.name} className="flex items-center justify-between p-4 rounded-2xl" style={{ background: 'linear-gradient(to right, rgba(109, 99, 242, 0.1), rgba(109, 99, 242, 0.05))' }}>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{product.orders} طلب</span>
                  <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#6D63F2', color: 'white' }}>
                    {product.percentage}%
                  </span>
                </div>
                <span className="text-sm font-medium text-green-600">{product.revenue.toLocaleString()} د.ع</span>
              </div>
              <div className="text-right">
                <h4 className="font-medium text-gray-800">{product.name}</h4>
                <span className="text-sm" style={{ color: '#6D63F2' }}>المرتبة #{index + 1}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
