import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, ShoppingBag } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import OptimizedImage from '@/components/OptimizedImage';
import { useInView } from '@/hooks/useInView';
import {
  fetchSuggestedProductsForOwner,
  fetchSuggestedProductsForStore,
} from '@/services/suggestedProductsService';

import type { SuggestedProductCard } from '@/services/suggestedProductsService';

interface SuggestedProductsProps {
  currentProductId: string;
  storeSlug?: string;
  category?: string;
  /** From page bundle — skips separate fetch when provided */
  prefetchedProducts?: SuggestedProductCard[] | null;
}

const SuggestedProducts = ({
  currentProductId,
  storeSlug,
  prefetchedProducts = null,
}: SuggestedProductsProps) => {
  const [sectionRef, inView] = useInView<HTMLDivElement>();
  const [suggestedProducts, setSuggestedProducts] = useState<SuggestedProductCard[]>(
    () => prefetchedProducts ?? []
  );

  useEffect(() => {
    if (prefetchedProducts != null) {
      setSuggestedProducts(prefetchedProducts);
    }
  }, [prefetchedProducts]);

  useEffect(() => {
    if (prefetchedProducts != null) return;
    if (!inView || !currentProductId) return;

    const load = async () => {
      try {
        if (storeSlug) {
          setSuggestedProducts(await fetchSuggestedProductsForStore(storeSlug, currentProductId, 8));
          return;
        }
        const { getAuthenticatedUserId } = await import('@/lib/authSession');
        const ownerId = await getAuthenticatedUserId();
        if (!ownerId) return;
        setSuggestedProducts(await fetchSuggestedProductsForOwner(currentProductId, ownerId, 8));
      } catch (error) {
        console.error('Error in fetchSuggestedProducts:', error);
      }
    };
    void load();
  }, [currentProductId, storeSlug, inView, prefetchedProducts]);

  const productLink = (id: string) =>
    storeSlug ? `/store/${storeSlug}/product/${id}` : `/product-details/${id}`;

  if (suggestedProducts.length === 0) return null;

  return (
    <section ref={sectionRef} className="space-y-6" dir="rtl">
      <div className="flex items-end justify-between gap-4">
        <div className="text-right">
          <h2 className="sf-section-title">قد يعجبك أيضاً</h2>
          <p className="sf-section-subtitle mt-1">منتجات مختارة لك</p>
        </div>
      </div>

      <Carousel className="w-full" opts={{ align: 'start', direction: 'rtl', dragFree: true }}>
        <CarouselContent className="-mr-3">
          {suggestedProducts.map((product) => (
            <CarouselItem key={product.id} className="pr-3 basis-[52%] sm:basis-[38%] md:basis-[28%] lg:basis-[22%]">
              <Link to={productLink(product.id)} className="block group h-full">
                <article className="sf-card sf-card-hover h-full flex flex-col">
                  <div className="aspect-[3/4] relative overflow-hidden bg-muted/20">
                    <OptimizedImage
                      src={product.image_url || '/placeholder.svg'}
                      alt={product.name}
                      variant="thumbnail"
                      className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500"
                      loading="lazy"
                      sizes="240px"
                    />
                  </div>
                  <div className="p-4 space-y-2 flex-1 flex flex-col">
                    <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                      {product.rating != null && product.rating > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          {product.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="text-sm font-bold text-foreground tabular-nums">
                        {product.price.toLocaleString('ar-IQ')} د.ع
                      </span>
                    </div>
                    <span className="inline-flex items-center justify-center gap-1.5 h-9 rounded-xl bg-primary/8 text-primary text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      عرض المنتج
                    </span>
                  </div>
                </article>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
};

export default SuggestedProducts;
