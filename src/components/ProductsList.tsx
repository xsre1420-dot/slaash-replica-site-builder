
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

export const ProductsList = () => {
  // This will be replaced with real data once we integrate with a backend
  const products: any[] = [];

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm text-center space-y-4">
        <div className="flex justify-center">
          <svg className="w-12 h-12 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v18H3zM16 8l-4 4m0 0l-4-4m4 4v8m-4-4h8" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-700">لا توجد وجبات مسجلة</h3>
        <p className="text-gray-500">يمكنك البدء بإضافة وجبات جديدة</p>
        <Link to="/add-product">
          <Button className="bg-red-600 hover:bg-red-700">
            <Plus className="w-4 h-4 ml-2" />
            إضافة وجبة جديدة
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {products.map((product) => (
        <div key={product.id} className="bg-white rounded-lg shadow p-4">
          {/* Product details will be added here once we have data */}
        </div>
      ))}
    </div>
  );
};
