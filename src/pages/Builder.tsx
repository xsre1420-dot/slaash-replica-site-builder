
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
      {/* Modern Store Header */}
      <div className="bg-white shadow-sm">
        <StoreHeader 
          storeName={storeName} 
          storeLogo={storeLogo} 
          onUpdateStore={updateStore} 
        />
      </div>
      
      <div className="p-6 max-w-6xl mx-auto">
        {/* Modern URL Sharing Card */}
        <div className="bg-gradient-to-r from-orange-500 to-pink-500 rounded-3xl p-6 mb-8 text-white">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">رابط المطعم</h2>
            <p className="opacity-90">شارك الرابط مع زبائنك</p>
          </div>
          
          <div className="flex items-center gap-3 mb-6">
            <Input 
              value="https://yourstore.com/menu" 
              readOnly 
              className="text-left bg-white/20 border-white/30 text-white placeholder-white/70 rounded-2xl backdrop-blur-sm"
            />
            <Button className="bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-2xl backdrop-blur-sm">
              نسخ
            </Button>
          </div>
          
          {/* Modern Action Grid */}
          <div className="grid grid-cols-2 gap-4">
            <Link to="/preview">
              <Button variant="ghost" className="w-full h-14 bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-2xl backdrop-blur-sm">
                <Eye className="w-5 h-5 ml-2" />
                معاينة المتجر
              </Button>
            </Link>
            <Link to="/add-product">
              <Button className="w-full h-14 bg-white hover:bg-gray-100 text-gray-800 rounded-2xl">
                <Plus className="w-5 h-5 ml-2" />
                إضافة وجبة
              </Button>
            </Link>
          </div>
        </div>

        {/* Modern Dashboard Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link to="/orders" className="group">
            <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
                <List className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">الطلبات</h3>
              <p className="text-sm text-gray-500">إدارة الطلبات</p>
            </div>
          </Link>
          
          <Link to="/categories" className="group">
            <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
              <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center mb-4">
                <Tag className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">الأصناف</h3>
              <p className="text-sm text-gray-500">تنظيم الأصناف</p>
            </div>
          </Link>
          
          <Link to="/settings" className="group">
            <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
              <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mb-4">
                <Settings className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">الإعدادات</h3>
              <p className="text-sm text-gray-500">إعدادات المتجر</p>
            </div>
          </Link>
          
          <div className="bg-white p-6 rounded-3xl shadow-sm">
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="font-bold text-gray-800 mb-1">الإحصائيات</h3>
            <p className="text-sm text-gray-500">قريباً</p>
          </div>
        </div>

        {/* Modern Products Section */}
        <Card className="border-0 shadow-sm rounded-3xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-gray-800">منتجاتك</CardTitle>
              <Link to="/add-product" className="text-orange-500 hover:text-orange-600 text-sm flex items-center font-medium">
                <Plus className="w-4 h-4 ml-1" />
                منتج جديد
              </Link>
            </div>
            <CardDescription className="text-gray-500">إدارة قائمة الطعام</CardDescription>
          </CardHeader>
          <CardContent>
            <ProductsList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
