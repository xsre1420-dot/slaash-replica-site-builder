
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
        {/* Modern Action Grid */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <Link to="/preview">
            <Button variant="ghost" className="w-full h-16 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-2xl text-lg shadow-sm">
              <Eye className="h-5 w-5 ml-2" />
              معاينة المتجر
            </Button>
          </Link>
          <Link to="/add-product">
            <Button className="w-full h-16 text-white rounded-2xl shadow-lg border-0 text-lg font-semibold"
                    style={{ 
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
                    }}>
              <Plus className="h-5 w-5 ml-2" />
              إضافة وجبة
            </Button>
          </Link>
        </div>

        {/* Modern Dashboard Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link to="/orders" className="group">
            <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
              <List className="h-8 w-8 text-indigo-500 mb-4" />
              <h3 className="font-bold text-xl text-gray-800 mb-2">الطلبات</h3>
              <p className="text-gray-500">إدارة الطلبات</p>
            </div>
          </Link>
          
          <Link to="/categories" className="group">
            <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
              <Tag className="h-8 w-8 text-purple-500 mb-4" />
              <h3 className="font-bold text-xl text-gray-800 mb-2">الأصناف</h3>
              <p className="text-gray-500">تنظيم الأصناف</p>
            </div>
          </Link>
          
          <Link to="/settings" className="group">
            <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
              <Settings className="h-8 w-8 text-blue-500 mb-4" />
              <h3 className="font-bold text-xl text-gray-800 mb-2">الإعدادات</h3>
              <p className="text-gray-500">إعدادات المتجر</p>
            </div>
          </Link>
          
          <Link to="/statistics" className="group">
            <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
              <BarChart3 className="h-8 w-8 text-green-500 mb-4" />
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
