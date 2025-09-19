
import { Link } from "react-router-dom";
import { Calendar, Eye, List, Plus, Tag, Settings, BarChart3, Users, Copy, Check, Package, Menu, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StoreHeader from "@/components/StoreHeader";
import RightSidebar from "@/components/RightSidebar";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { toast } from "sonner";

export default function Builder() {
  const { storeName, storeLogo, updateStore } = useStore();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </div>
      
      {/* Main Content with Right Sidebar Layout */}
      <div className="flex">
        {/* Main Content Area */}
        <div className="flex-1 md:pr-24 p-6 max-w-6xl mx-auto">
          {/* Modern URL Sharing Card - White Background */}
          <div className="bg-white rounded-3xl p-6 mb-8 border border-gray-200 shadow-sm">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2 text-gray-800">رابط المتجر</h2>
              <p className="text-gray-600">شارك المتجر مع عملائك</p>
            </div>
            
            <div className="flex items-center gap-3 mb-6">
              <Input 
                value={user ? `${window.location.origin}/store/${user.username}` : 'جاري التحميل...'}
                readOnly 
                className="text-left bg-gray-50 border-gray-200 text-gray-700 rounded-2xl font-mono text-sm"
              />
              <Button 
                className={`transition-all duration-200 rounded-2xl min-w-[80px] ${
                  copied 
                    ? 'bg-green-100 hover:bg-green-200 text-green-700 border-green-200' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
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
                    <Check className="w-4 h-4 ml-2" />
                    تم النسخ
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 ml-2" />
                    نسخ
                  </>
                )}
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
        
        {/* Right Sidebar */}
        <RightSidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
        />
      </div>
    </div>
  );
}
