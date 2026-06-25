import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { useInView } from "@/hooks/useInView";
import {
  fetchSuggestedProductsForOwner,
  fetchSuggestedProductsForStore,
} from "@/services/suggestedProductsService";

interface SuggestedProductsProps {
  currentProductId: string;
  storeSlug?: string;
  category?: string;
}

const SuggestedProducts = ({ currentProductId, storeSlug }: SuggestedProductsProps) => {
  const [sectionRef, inView] = useInView<HTMLDivElement>();
  const [suggestedProducts, setSuggestedProducts] = useState<
    Awaited<ReturnType<typeof fetchSuggestedProductsForStore>>
  >([]);

  useEffect(() => {
    if (!inView || !currentProductId) return;

    const load = async () => {
      try {
        if (storeSlug) {
          setSuggestedProducts(
            await fetchSuggestedProductsForStore(storeSlug, currentProductId, 4)
          );
          return;
        }

        const { getAuthenticatedUserId } = await import("@/lib/authSession");
        const ownerId = await getAuthenticatedUserId();
        if (!ownerId) return;

        setSuggestedProducts(
          await fetchSuggestedProductsForOwner(currentProductId, ownerId, 4)
        );
      } catch (error) {
        console.error("Error in fetchSuggestedProducts:", error);
      }
    };
    void load();
  }, [currentProductId, storeSlug, inView]);

  const productLink = (id: string) =>
    storeSlug ? `/store/${storeSlug}/product/${id}` : `/product-details/${id}`;

  return (
    <div ref={sectionRef} className="space-y-4 mt-6">
      {suggestedProducts.length === 0 ? null : (
        <>
      <h2 className="text-lg font-bold text-right text-foreground">قد يعجبك أيضاً</h2>

      <Carousel className="w-full">
        <CarouselContent className="-ml-2">
          {suggestedProducts.map((product) => (
            <CarouselItem key={product.id} className="pl-2 basis-[45%]">
              <Link to={productLink(product.id)} className="block">
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
                      <span className="text-sm font-bold text-foreground">{product.price.toLocaleString()} د.ع</span>
                    </div>
                  </div>
                </div>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
        </>
      )}
    </div>
  );
};

export default SuggestedProducts;
