import { X, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ProductsList } from "@/components/ProductsList";

const Products = () => {
  return (
    <div className="min-h-screen bg-gray-50 font-arabic">
      {/* Modern Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link to="/builder">
              <Button variant="ghost" className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-6 h-6" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-black">إدارة المنتجات</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-3xl shadow-sm p-8">
          <div className="flex justify-between items-center mb-8">
            <Link to="/add-product">
              <Button 
                className="text-white rounded-2xl px-8 py-3 border-0 shadow-lg"
                style={{ 
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)'
                }}
              >
                <Plus className="w-5 h-5 ml-2" />
                إضافة منتج جديد
              </Button>
            </Link>
            <h2 className="text-2xl font-bold text-black">قائمة المنتجات</h2>
          </div>

          <ProductsList />
        </div>
      </div>
    </div>
  );
};

export default Products;