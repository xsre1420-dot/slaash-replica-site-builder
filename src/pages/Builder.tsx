
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
      {/* Header with better styling */}
      <div className="bg-primary text-white p-4">
        <div className="max-w-6xl mx-auto">
          <StoreHeader 
            storeName={storeName} 
            storeLogo={storeLogo} 
            onUpdateStore={updateStore} 
          />
        </div>
      </div>
      
      <div className="p-4 max-w-6xl mx-auto">
        <div className="bg-white rounded-xl p-6 shadow-sm border mb-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-primary mb-2">رابط المطعم</h2>
            <p className="text-dark-green">مشاركة الرابط مع الزبائن</p>
          </div>
          
          <div className="flex items-center gap-2 mb-8">
            <Input 
              value="https://yourstore.com/menu" 
              readOnly 
              className="text-left bg-gray-50"
            />
            <Button variant="destructive" className="whitespace-nowrap bg-primary hover:bg-primary/90 text-white border-primary">
              نسخ
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Link to="/preview">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2 py-6 text-dark-green border-primary hover:bg-primary/10 transition-colors">
                <Eye className="w-5 h-5 ml-2" />
                معاينة
              </Button>
            </Link>
            <Link to="/add-product">
              <Button className="w-full bg-primary hover:bg-primary/90 flex items-center justify-center gap-2 py-6 transition-colors">
                <Plus className="w-5 h-5 ml-2" />
                إضافة وجبة
              </Button>
            </Link>
            <Link to="/orders">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2 py-6 text-dark-green border-primary hover:bg-primary/10 transition-colors">
                <List className="w-5 h-5 ml-2" />
                الطلبات
              </Button>
            </Link>
            <Link to="/categories">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2 py-6 text-dark-green border-primary hover:bg-primary/10 transition-colors">
                <Tag className="w-5 h-5 ml-2" />
                الأصناف
              </Button>
            </Link>
          </div>
        </div>

        <Card className="shadow-sm border">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-dark-green">المنتجات</CardTitle>
              <Link to="/add-product" className="text-primary hover:underline text-sm flex items-center transition-colors">
                <Plus className="w-4 h-4 ml-1" />
                إضافة منتج جديد
              </Link>
            </div>
            <CardDescription className="text-dark-green">إدارة منتجات المنيو</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <ProductsList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
