
import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { X, ShoppingCart, ChevronRight, ChevronLeft } from "lucide-react";
import { getProductById, categories } from "@/data/dummyData";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const ProductDetails = () => {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (productId) {
      const foundProduct = getProductById(productId);
      if (foundProduct) {
        setProduct(foundProduct);
      } else {
        navigate('/preview');
      }
    }
  }, [productId, navigate]);

  const handleAddToCart = () => {
    if (product) {
      addToCart(product);
    }
  };

  const nextImage = () => {
    if (!product) return;
    
    const allImages = [
      product.image,
      ...(product.additionalImages || [])
    ];
    
    setActiveImageIndex((prevIndex) => 
      prevIndex === allImages.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevImage = () => {
    if (!product) return;
    
    const allImages = [
      product.image,
      ...(product.additionalImages || [])
    ];
    
    setActiveImageIndex((prevIndex) => 
      prevIndex === 0 ? allImages.length - 1 : prevIndex - 1
    );
  };

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-gray-700 mb-2">جاري التحميل...</h2>
        </div>
      </div>
    );
  }

  const allImages = [
    product.image,
    ...(product.additionalImages || [])
  ];

  const categoryName = categories.find(c => c.id === product.category)?.name || product.category;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-red-600 text-white p-4 flex justify-between items-center">
        <Link to="/preview">
          <X className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold">تفاصيل المنتج</h1>
        <div className="w-6" />
      </div>

      <div className="p-4">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Product Images Carousel - Made smaller */}
          <div className="relative bg-white">
            <div className="aspect-square w-full max-h-80 relative">
              <img
                src={allImages[activeImageIndex]}
                alt={product.name}
                className="w-full h-full object-contain"
              />
              
              {allImages.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/70 rounded-full h-8 w-8"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/70 rounded-full h-8 w-8"
                    onClick={nextImage}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}
              
              {/* Image Indicators */}
              {allImages.length > 1 && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                  {allImages.map((_, index) => (
                    <button
                      key={index}
                      className={`w-2 h-2 rounded-full ${
                        index === activeImageIndex ? "bg-red-600" : "bg-white/70"
                      }`}
                      onClick={() => setActiveImageIndex(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Product Details - Improved layout */}
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center">
                <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100">
                  {categoryName}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold text-right">{product.name}</h1>
            </div>
            
            <p className="text-red-600 text-xl font-bold text-right">{product.price.toLocaleString()} د.ع</p>
            
            {product.description && (
              <div className="text-right">
                <h2 className="text-lg font-bold mb-2">الوصف</h2>
                <p className="text-gray-600">{product.description}</p>
              </div>
            )}

            {/* Add to Cart Button */}
            <Button 
              className="w-full bg-red-600 hover:bg-red-700 py-6 text-lg"
              onClick={handleAddToCart}
            >
              <ShoppingCart className="ml-2 h-5 w-5" />
              أضف إلى السلة
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;
