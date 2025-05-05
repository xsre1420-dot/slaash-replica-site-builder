
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Calendar, Eye, List, Plus, Tag } from "lucide-react";
import { ProductsList } from "@/components/ProductsList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StoreHeader from "@/components/StoreHeader";
import { useStore } from "@/context/StoreContext";

export default function Builder() {
  const { storeName, storeLogo, updateStore } = useStore();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Store Header */}
      <StoreHeader 
        storeName={storeName} 
        storeLogo={storeLogo} 
        onUpdateStore={updateStore} 
      />
      
      <div className="p-8 max-w-6xl mx-auto">
        <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-red-600 mb-2">رابط المطعم</h2>
            <p className="text-gray-500">مشاركة الرابط مع الزبائن</p>
          </div>
          
          <div className="flex items-center gap-2 mb-8">
            <Input 
              value="https://yourstore.com/menu" 
              readOnly 
              className="text-left bg-gray-50"
            />
            <Button variant="destructive" className="whitespace-nowrap">
              نسخ
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Link to="/preview">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2 py-6">
                <Eye className="w-5 h-5 ml-2" />
                معاينة
              </Button>
            </Link>
            <Link to="/add-product">
              <Button className="w-full bg-red-600 hover:bg-red-700 flex items-center justify-center gap-2 py-6">
                <Plus className="w-5 h-5 ml-2" />
                إضافة وجبة
              </Button>
            </Link>
            <Link to="/orders">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2 py-6">
                <List className="w-5 h-5 ml-2" />
                الطلبات
              </Button>
            </Link>
            <Link to="/categories">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2 py-6">
                <Tag className="w-5 h-5 ml-2" />
                الأصناف
              </Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>المنتجات</CardTitle>
              <Link to="/add-product" className="text-red-600 hover:underline text-sm flex items-center">
                <Plus className="w-4 h-4 ml-1" />
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
