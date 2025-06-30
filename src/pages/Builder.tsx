
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Calendar, Eye, List, Plus, Tag, Settings, BarChart3, Users } from "lucide-react";
import { ProductsList } from "@/components/ProductsList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StoreHeader from "@/components/StoreHeader";
import { useStore } from "@/context/StoreContext";

export default function Builder() {
  const { storeName, storeLogo, updateStore } = useStore();

  return (
    <div className="min-h-screen bg-gray-50 font-arabic">
      {/* Modern Store Header - White Background */}
      <div className="bg-white shadow-sm">
        <StoreHeader 
          storeName={storeName} 
          storeLogo={storeLogo} 
          onUpdateStore={updateStore} 
        />
      </div>
      
      <div className="p-6 max-w-6xl mx-auto">
        {/* Modern URL Sharing Card - White Background */}
        <div className="bg-white rounded-3xl p-8 mb-8 border border-gray-200 shadow-sm">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-3 text-gray-800">رابط المطعم</h2>
            <p className="text-lg text-gray-600">شارك الرابط مع زبائنك</p>
          </div>
          
          <div className="flex items-center gap-4 mb-8">
            <Input 
              value="https://yourstore.com/menu" 
              readOnly 
              className="text-left bg-gray-50 border-gray-200 text-gray-700 rounded-2xl h-14 text-lg"
            />
            <Button className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200 rounded-2xl h-14 px-8 text-lg">
              نسخ
            </Button>
          </div>
          
          {/* Modern Action Grid */}
          <div className="grid grid-cols-2 gap-6">
            <Link to="/preview">
              <Button variant="ghost" className="w-full h-16 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-2xl text-lg">
                معاينة المتجر
              </Button>
            </Link>
            <Link to="/add-product">
              <Button className="w-full h-16 text-white rounded-2xl shadow-lg border-0 text-lg font-semibold"
                      style={{ 
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
                      }}>
                إضافة وجبة
              </Button>
            </Link>
          </div>
        </div>

        {/* Modern Dashboard Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link to="/orders" className="group">
            <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
              <h3 className="font-bold text-xl text-gray-800 mb-2">الطلبات</h3>
              <p className="text-gray-500">إدارة الطلبات</p>
            </div>
          </Link>
          
          <Link to="/categories" className="group">
            <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
              <h3 className="font-bold text-xl text-gray-800 mb-2">الأصناف</h3>
              <p className="text-gray-500">تنظيم الأصناف</p>
            </div>
          </Link>
          
          <Link to="/settings" className="group">
            <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
              <h3 className="font-bold text-xl text-gray-800 mb-2">الإعدادات</h3>
              <p className="text-gray-500">إعدادات المتجر</p>
            </div>
          </Link>
          
          <Link to="/statistics" className="group">
            <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
              <h3 className="font-bold text-xl text-gray-800 mb-2">الإحصائيات</h3>
              <p className="text-gray-500">تقارير وإحصاءات</p>
            </div>
          </Link>
        </div>

        {/* Modern Products Section */}
        <Card className="border-0 shadow-sm rounded-3xl">
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-gray-800">منتجاتك</CardTitle>
              <Link to="/add-product" className="text-indigo-500 hover:text-indigo-600 flex items-center font-medium">
                منتج جديد
              </Link>
            </div>
            <CardDescription className="text-gray-500 text-lg">إدارة قائمة الطعام</CardDescription>
          </CardHeader>
          <CardContent>
            <ProductsList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
