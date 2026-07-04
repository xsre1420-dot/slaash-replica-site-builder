import { useState, useEffect } from "react";

import { Link } from "react-router-dom";

import { Star } from "lucide-react";

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



  if (suggestedProducts.length === 0) return null;



  return (

    <section ref={sectionRef} className="space-y-5">

      <h2 className="text-xl font-bold text-right text-foreground tracking-tight">قد يعجبك أيضاً</h2>



      <Carousel className="w-full" opts={{ align: "start", direction: "rtl" }}>

        <CarouselContent className="-mr-2">

          {suggestedProducts.map((product) => (

            <CarouselItem key={product.id} className="pr-2 basis-[46%] sm:basis-[32%] lg:basis-[24%]">

              <Link to={productLink(product.id)} className="block group h-full">

                <div className="rounded-2xl overflow-hidden transition-all duration-300 border border-border/10 hover:border-primary/25 hover:shadow-md hover:shadow-primary/5 h-full flex flex-col">

                  <div className="aspect-square relative overflow-hidden">

                    <img

                      src={product.image_url || "/placeholder.svg"}

                      alt={product.name}

                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"

                      loading="lazy"

                    />

                  </div>

                  <div className="p-3.5 space-y-1.5 flex-1 flex flex-col">

                    <h3 className="text-sm font-bold text-foreground line-clamp-1 text-right group-hover:text-primary transition-colors">

                      {product.name}

                    </h3>

                    {product.short_description?.trim() && (

                      <p className="text-[11px] text-muted-foreground line-clamp-2 text-right leading-snug flex-1">

                        {product.short_description.trim()}

                      </p>

                    )}

                    <div className="flex items-center justify-between gap-2 pt-1">

                      {product.rating != null && product.rating > 0 ? (

                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">

                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />

                          {product.rating.toFixed(1)}

                        </span>

                      ) : (

                        <span />

                      )}

                      <span className="text-sm font-bold text-foreground tabular-nums">

                        {product.price.toLocaleString()} د.ع

                      </span>

                    </div>

                  </div>

                </div>

              </Link>

            </CarouselItem>

          ))}

        </CarouselContent>

      </Carousel>

    </section>

  );

};



export default SuggestedProducts;

