
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Calendar, Eye, List } from "lucide-react";
import { ProductsList } from "@/components/ProductsList";

export default function Builder() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card for Restaurant Menu */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">المنيو</CardTitle>
              <CardDescription>إدارة المنيو والمنتجات</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                قم بإضافة وتعديل وحذف المنتجات التي تظهر في المنيو.
              </p>
              <Link to="/add-product" className="text-blue-600 hover:underline block text-sm">
                إضافة منتج جديد
              </Link>
              <Link to="/preview" className="text-blue-600 hover:underline block text-sm mt-2">
                معاينة المنيو
              </Link>
            </CardContent>
          </Card>

          {/* Card for Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">الفئات</CardTitle>
              <CardDescription>إدارة فئات المنيو</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                قم بإنشاء وتحرير فئات المنتجات في المنيو الخاص بك.
              </p>
              <Link to="/categories" className="text-blue-600 hover:underline block text-sm">
                إدارة الفئات
              </Link>
            </CardContent>
          </Card>

          {/* Card for Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">الطلبات</CardTitle>
              <CardDescription>إدارة طلبات العملاء</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                عرض وإدارة طلبات العملاء وتتبع المبيعات.
              </p>
              <Link to="/orders" className="text-blue-600 hover:underline block text-sm">
                عرض الطلبات
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>المنتجات</CardTitle>
              <Link to="/add-product" className="text-blue-600 hover:underline text-sm">
                إضافة منتج جديد
              </Link>
            </div>
            <CardDescription>إدارة منتجات المنيو</CardDescription>
          </CardHeader>
          <CardContent>
            <ProductsList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
