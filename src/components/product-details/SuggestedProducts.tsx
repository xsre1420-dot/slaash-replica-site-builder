import { useState, useEffect } from "react";
import { Product } from "@/types";
import { Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

interface SuggestedProductsProps {
  currentProductId: string;
  category?: string;
}

const SuggestedProducts = ({ currentProductId, category }: SuggestedProductsProps) => {
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);

  // Mock suggested products data - in real app, this would come from API
  useEffect(() => {
    const mockProducts: Product[] = [
      {
        id: "1",
        name: "تيشيرت بولو مع تفاصيل متباينة",
        price: 212,
        image: "/lovable-uploads/3482b4a1-01de-4784-b929-e9e4d755830f.png",
        description: "تيشيرت عالي الجودة",
        category: "ملابس",
        rating: 4.2,
        reviewCount: 142,
        originalPrice: 242
      },
      {
        id: "2", 
        name: "تيشيرت جرافيك متدرج",
        price: 145,
        image: "/lovable-uploads/59c215d6-809e-4764-90cd-41fd1213f286.png",
        description: "تيشيرت بتصميم عصري",
        category: "ملابس",
        rating: 4.5,
        reviewCount: 324,
        originalPrice: 165
      },
      {
        id: "3",
        name: "بولو بتفاصيل الطرف",
        price: 180,
        image: "/lovable-uploads/6fd4999f-4557-46fe-922a-3af4fd437caf.png", 
        description: "بولو أنيق ومريح",
        category: "ملابس",
        rating: 4.4,
        reviewCount: 256,
        originalPrice: 200
      },
      {
        id: "4",
        name: "جاكيت مخطط",
        price: 120,
        image: "/lovable-uploads/c85f9015-cfa6-476e-9165-72dfbfb5c4b0.png",
        description: "جاكيت عصري وأنيق",
        category: "ملابس", 
        rating: 4.6,
        reviewCount: 189,
        originalPrice: 140
      }
    ];
    
    // Filter out current product and limit to 4
    const filtered = mockProducts.filter(p => p.id !== currentProductId).slice(0, 4);
    setSuggestedProducts(filtered);
  }, [currentProductId]);

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3 h-3 ${
              star <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  if (suggestedProducts.length === 0) return null;

  return (
    <div className="space-y-6 mt-8">
      <h2 className="text-2xl font-bold text-center text-gray-900">
        قد يعجبك أيضاً
      </h2>
      
      <div className="px-4">
        <Carousel className="w-full">
          <CarouselContent className="-ml-2 md:-ml-4">
            {suggestedProducts.map((product) => (
              <CarouselItem key={product.id} className="pl-2 md:pl-4 basis-1/2 md:basis-1/3 lg:basis-1/4">
                <Link to={`/product-details/${product.id}`} className="block">
                  <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow">
                    <div className="aspect-square bg-gray-100">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    <div className="p-4 space-y-2">
                      <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 text-right">
                        {product.name}
                      </h3>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {renderStars(product.rating || 0)}
                          <span className="text-xs text-gray-500">
                            {product.reviewCount || 0}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900">
                            {product.price.toLocaleString()} د.ع
                          </div>
                          {product.originalPrice && product.originalPrice > product.price && (
                            <div className="text-xs text-gray-500 line-through">
                              {product.originalPrice.toLocaleString()} د.ع
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {product.originalPrice && product.originalPrice > product.price && (
                        <div className="text-right">
                          <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                            -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2" />
          <CarouselNext className="right-2" />
        </Carousel>
      </div>
    </div>
  );
};

export default SuggestedProducts;