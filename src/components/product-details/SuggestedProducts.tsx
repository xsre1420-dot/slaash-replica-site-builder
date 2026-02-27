import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";

interface SuggestedProduct {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  category: string;
}

interface SuggestedProductsProps {
  currentProductId: string;
  category?: string;
}

const SuggestedProducts = ({ currentProductId, category }: SuggestedProductsProps) => {
  const [suggestedProducts, setSuggestedProducts] = useState<SuggestedProduct[]>([]);

  useEffect(() => {
    const fetchSuggestedProducts = async () => {
      if (!currentProductId) return;
      try {
        const { data: suggestedData, error: suggestedError } = await (supabase as any)
          .from('suggested_products')
          .select('suggested_product_id')
          .eq('product_id', currentProductId)
          .limit(10);

        if (suggestedError || !suggestedData?.length) return;

        const productIds = suggestedData.map((sp: any) => sp.suggested_product_id);
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, name, price, image_url, category')
          .in('id', productIds);

        if (!productsError && productsData) {
          setSuggestedProducts(productsData.slice(0, 4));
        }
      } catch (error) {
        console.error('Error in fetchSuggestedProducts:', error);
      }
    };
    fetchSuggestedProducts();
  }, [currentProductId]);

  if (suggestedProducts.length === 0) return null;

  return (
    <div className="space-y-4 mt-6">
      <h2 className="text-lg font-bold text-right text-foreground">قد يعجبك أيضاً</h2>
      
      <Carousel className="w-full">
        <CarouselContent className="-ml-2">
          {suggestedProducts.map((product) => (
            <CarouselItem key={product.id} className="pl-2 basis-[45%]">
              <Link to={`/product-details/${product.id}`} className="block">
                <div className="bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-md transition-all">
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    <img
                      src={product.image_url || '/placeholder.svg'}
                      alt={product.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3 space-y-1.5">
                    <h3 className="text-sm font-semibold text-foreground line-clamp-1 text-right">
                      {product.name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-amber-400 fill-current" />
                        <span className="text-[10px] text-muted-foreground">4.5</span>
                      </div>
                      <span className="text-sm font-bold text-foreground">{product.price.toLocaleString()} د.ع</span>
                    </div>
                  </div>
                </div>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
};

export default SuggestedProducts;
