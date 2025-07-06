
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
        <div className="bg-white rounded-3xl p-6 mb-8 border border-gray-200 shadow-sm">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2 text-gray-800">رابط المتجر</h2>
            <p className="text-gray-600">شارك المتجر مع عملائك</p>
          </div>
          
          <div className="flex items-center gap-3 mb-6">
            <Input 
              value={`${window.location.origin}/store`}
              readOnly 
              className="text-left bg-gray-50 border-gray-200 text-gray-700 rounded-2xl"
            />
            <Button 
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200 rounded-2xl"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/store`);
                // You could add a toast notification here
              }}
            >
              نسخ
            </Button>
          </div>
          
          {/* Modern Action Grid */}
          <div className="grid grid-cols-2 gap-4">
            <Link to="/preview">
              <Button variant="ghost" className="w-full h-14 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-2xl">
                <Eye className="w-5 h-5 ml-2" />
                معاينة المتجر
              </Button>
            </Link>
            <Link to="/add-product">
              <Button className="w-full h-14 text-white rounded-2xl shadow-lg border-0"
                      style={{ 
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
                      }}>
                <Plus className="w-5 h-5 ml-2" />
                إضافة منتج
              </Button>
            </Link>
          </div>
        </div>

        {/* Modern Dashboard Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link to="/orders" className="group">
            <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                   style={{ 
                     background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                     boxShadow: '0 4px 15px rgba(99, 102, 241, 0.2)'
                   }}>
                <List className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">الطلبات</h3>
              <p className="text-sm text-gray-500">إدارة الطلبات</p>
            </div>
          </Link>
          
          <Link to="/categories" className="group">
            <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                   style={{ 
                     background: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
                     boxShadow: '0 4px 15px rgba(139, 92, 246, 0.2)'
                   }}>
                <Tag className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">الأصناف</h3>
              <p className="text-sm text-gray-500">تنظيم الأصناف</p>
            </div>
          </Link>
          
          <Link to="/settings" className="group">
            <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                   style={{ 
                     background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                     boxShadow: '0 4px 15px rgba(6, 182, 212, 0.2)'
                   }}>
                <Settings className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">الإعدادات</h3>
              <p className="text-sm text-gray-500">إعدادات المتجر</p>
            </div>
          </Link>
          
          <Link to="/statistics" className="group">
            <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1 cursor-pointer">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                   style={{ 
                     background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                     boxShadow: '0 4px 15px rgba(59, 130, 246, 0.2)'
                   }}>
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">الإحصائيات</h3>
              <p className="text-sm text-gray-500">تقارير وإحصاءات</p>
            </div>
          </Link>
        </div>

        {/* Modern Products Section */}
        <Card className="border-0 shadow-sm rounded-3xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-gray-800">منتجاتك</CardTitle>
              <Link to="/add-product" className="text-indigo-500 hover:text-indigo-600 text-sm flex items-center font-medium">
                <Plus className="w-4 h-4 ml-1" />
                منتج جديد
              </Link>
            </div>
            <CardDescription className="text-gray-500">إدارة قائمة المنتجات</CardDescription>
          </CardHeader>
          <CardContent>
            <ProductsList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
