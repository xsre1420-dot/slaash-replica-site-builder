import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

interface SuggestedProduct {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  category: string;
  rating?: number;
  reviewCount?: number;
  originalPrice?: number;
}

interface SuggestedProductsProps {
  currentProductId: string;
  category?: string;
}

const SuggestedProducts = ({ currentProductId, category }: SuggestedProductsProps) => {
  const [suggestedProducts, setSuggestedProducts] = useState<SuggestedProduct[]>([]);

  // Mock suggested products data - in real app, this would come from API
  useEffect(() => {
    const fetchSuggestedProducts = async () => {
      if (!currentProductId) return;

      try {
        // First get the suggested products for this product
        const { data: suggestedData, error: suggestedError } = await supabase
          .from('suggested_products')
          .select('suggested_product_id, display_order')
          .eq('product_id', currentProductId)
          .order('display_order', { ascending: true });

        if (suggestedError) {
          console.error('Error fetching suggested products:', suggestedError);
          return;
        }

        if (suggestedData && suggestedData.length > 0) {
          // Get the actual product details for suggested products
          const productIds = suggestedData.map(sp => sp.suggested_product_id);
          const { data: productsData, error: productsError } = await supabase
            .from('products')
            .select('id, name, price, image_url, category')
            .in('id', productIds);

          if (productsError) {
            console.error('Error fetching product details:', productsError);
            return;
          }

          // Combine and sort the data based on display_order
          const combinedProducts = suggestedData
            .map(sp => {
              const product = productsData?.find(p => p.id === sp.suggested_product_id);
              if (!product) return null;
              
              return {
                id: product.id,
                name: product.name,
                price: product.price,
                image_url: product.image_url,
                category: product.category,
                rating: 4.0 + Math.random(),
                reviewCount: Math.floor(Math.random() * 500) + 50,
                originalPrice: Math.random() > 0.5 ? product.price + Math.floor(Math.random() * 50) + 20 : undefined
              } as SuggestedProduct;
            })
            .filter((product): product is SuggestedProduct => product !== null)
            .slice(0, 4);

          setSuggestedProducts(combinedProducts);
        }
      } catch (error) {
        console.error('Error in fetchSuggestedProducts:', error);
      }
    };

    fetchSuggestedProducts();
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
                        src={product.image_url || '/placeholder-product.jpg'}
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