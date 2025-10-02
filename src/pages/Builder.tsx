
import { Link } from "react-router-dom";
import { Calendar, Eye, List, Plus, Tag, Settings, BarChart3, Users, Copy, Check, Package, Archive, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StoreHeader from "@/components/StoreHeader";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { toast } from "sonner";
import platformLogo from "@/assets/platform-logo.png";

export default function Builder() {
  const { storeName, storeLogo, updateStore } = useStore();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 font-arabic">
      {/* Modern Store Header - White Background */}
      <div className="bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-2">
          <StoreHeader 
            storeName={storeName} 
            storeLogo={storeLogo} 
            onUpdateStore={updateStore} 
          />
        </div>
      </div>
      
      {/* Main Content */}
      <div className="p-6 max-w-6xl mx-auto">
          {/* Modern Store Link Card */}
          <div className="bg-white rounded-3xl p-12 mb-8">
            <div className="text-center mb-10">
              <div className="w-32 h-32 flex items-center justify-center mx-auto mb-8">
                <img src={platformLogo} alt="بيلانة" className="w-full h-full object-contain" />
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-5 max-w-2xl mx-auto">
              <Button 
                size="lg"
                className={`w-full transition-all duration-300 rounded-2xl px-10 py-7 text-lg shadow-lg ${
                  copied 
                    ? 'bg-green-500 hover:bg-green-600 text-white scale-105 shadow-green-200' 
                    : 'bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-200 hover:border-primary/40 hover:shadow-xl'
                }`}
                onClick={async () => {
                  if (user) {
                    try {
                      await navigator.clipboard.writeText(`${window.location.origin}/store/${user.username}`);
                      setCopied(true);
                      toast.success("تم نسخ الرابط بنجاح!");
                      setTimeout(() => setCopied(false), 2000);
                    } catch (error) {
                      toast.error("فشل في نسخ الرابط");
                    }
                  }
                }}
              >
                {copied ? (
                  <>
                    <Check className="w-6 h-6 ml-2" />
                    تم النسخ بنجاح
                  </>
                ) : (
                  <>
                    <Copy className="w-6 h-6 ml-2" />
                    نسخ رابط المتجر
                  </>
                )}
              </Button>
              
              {/* Quick Action Buttons */}
              <div className="grid grid-cols-2 gap-5 w-full">
                <Link to="/preview" className="w-full">
                  <Button variant="outline" className="w-full h-16 text-lg bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-200 hover:border-primary/40 rounded-2xl transition-all">
                    <Eye className="w-6 h-6 ml-2" />
                    معاينة المتجر
                  </Button>
                </Link>
                <Link to="/add-product" className="w-full">
                  <Button className="w-full h-16 text-lg bg-primary hover:bg-primary/90 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all border-0">
                    <Plus className="w-6 h-6 ml-2" />
                    إضافة منتج
                  </Button>
                </Link>
              </div>
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
            
            
            <Link to="/products" className="group">
              <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                     style={{ 
                       background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                       boxShadow: '0 4px 15px rgba(245, 158, 11, 0.2)'
                     }}>
                  <Package className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-800 mb-1">المنتجات</h3>
                <p className="text-sm text-gray-500">إدارة المنتجات</p>
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
            
            <Link to="/marketing" className="group">
              <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                     style={{ 
                       background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                       boxShadow: '0 4px 15px rgba(245, 158, 11, 0.2)'
                     }}>
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-800 mb-1">التسويق</h3>
                <p className="text-sm text-gray-500">كوبونات وإعلانات</p>
              </div>
            </Link>
            
            <Link to="/inventory" className="group">
              <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1 cursor-pointer">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                     style={{ 
                       background: 'linear-gradient(135deg, #10b981, #059669)',
                       boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)'
                     }}>
                  <Archive className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-800 mb-1">المخزون</h3>
                <p className="text-sm text-gray-500">إدارة المخزون</p>
              </div>
            </Link>
          </div>
        </div>
    </div>
  );
}
