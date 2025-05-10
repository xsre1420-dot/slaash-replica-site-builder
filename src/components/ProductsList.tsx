import { Button } from "@/components/ui/button";
import { Edit, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { products as initialProducts } from "@/data/dummyData";
import { Product } from "@/types";
import { useToast } from "@/components/ui/use-toast";

export const ProductsList = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // In a real app, we would fetch products from an API
    setProducts(initialProducts);
  }, []);

  const handleDelete = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
    toast({
      title: "تم الحذف بنجاح",
      description: "تم حذف المنتج بنجاح"
    });
  };

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
        <div key={product.id} className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex justify-between items-start">
            <div className="flex space-x-2">
              <Button 
                variant="ghost" 
                className="p-1 h-8 w-8" 
                onClick={() => handleDelete(product.id)}
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
              <Link to={`/edit-product/${product.id}`}>
                <Button 
                  variant="ghost" 
                  className="p-1 h-8 w-8" 
                >
                  <Edit className="w-4 h-4 text-blue-500" />
                </Button>
              </Link>
            </div>
            
            <div className="flex items-center">
              <div className="text-right mr-4">
                <h3 className="text-lg font-bold">{product.name}</h3>
                <p className="text-sm text-gray-500 line-clamp-1">{product.description}</p>
                <p className="text-red-600 font-bold mt-1">{product.price.toLocaleString()} د.ع</p>
              </div>
              <img
                src={product.image}
                alt={product.name}
                className="w-16 h-16 rounded-md object-cover"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
