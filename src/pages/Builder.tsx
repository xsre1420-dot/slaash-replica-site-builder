
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
    <div className="min-h-screen bg-white font-arabic">
      {/* Store Header */}
      <StoreHeader 
        storeName={storeName} 
        storeLogo={storeLogo} 
        onUpdateStore={updateStore} 
      />
      
      <div className="p-8 max-w-6xl mx-auto">
        <div className="bg-white rounded-xl p-6 shadow-sm mb-8 border border-gray-200">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-primary mb-2">رابط المطعم</h2>
            <p className="text-secondary-custom">مشاركة الرابط مع الزبائن</p>
          </div>
          
          <div className="flex items-center gap-2 mb-8">
            <Input 
              value="https://yourstore.com/menu" 
              readOnly 
              className="text-left bg-accent border-gray-200 font-english"
            />
            <Button variant="default" className="whitespace-nowrap bg-primary hover:bg-secondary text-white">
              نسخ
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Link to="/preview">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2 py-6 text-primary-custom border-gray-200 hover:bg-gray-50">
                <Eye className="w-5 h-5 ml-2" />
                معاينة
              </Button>
            </Link>
            <Link to="/add-product">
              <Button className="w-full bg-primary hover:bg-secondary flex items-center justify-center gap-2 py-6">
                <Plus className="w-5 h-5 ml-2" />
                إضافة وجبة
              </Button>
            </Link>
            <Link to="/orders">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2 py-6 text-primary-custom border-gray-200 hover:bg-gray-50">
                <List className="w-5 h-5 ml-2" />
                الطلبات
              </Button>
            </Link>
            <Link to="/categories">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2 py-6 text-primary-custom border-gray-200 hover:bg-gray-50">
                <Tag className="w-5 h-5 ml-2" />
                الأصناف
              </Button>
            </Link>
          </div>
        </div>

        <Card className="border border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-primary-custom">المنتجات</CardTitle>
              <Link to="/add-product" className="text-secondary hover:text-primary hover:underline text-sm flex items-center">
                <Plus className="w-4 h-4 ml-1" />
                إضافة منتج جديد
              </Link>
            </div>
            <CardDescription className="text-secondary-custom">إدارة منتجات المنيو</CardDescription>
          </CardHeader>
          <CardContent>
            <ProductsList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
