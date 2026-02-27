
import { useState, useCallback, useEffect } from "react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Sparkles, Flame, Tag } from "lucide-react";
import { useParallax } from "@/hooks/useParallax";

interface ProductImagesProps {
  images: string[];
  productName: string;
  isLarge?: boolean;
  isNew?: boolean;
  isLowStock?: boolean;
  stockQuantity?: number;
  isOutOfStock?: boolean;
  discountPercent?: number;
}

const ProductImages = ({ 
  images, productName, isLarge = false,
  isNew, isLowStock, stockQuantity, isOutOfStock, discountPercent 
}: ProductImagesProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [api, setApi] = useState<CarouselApi>();
  const [imgLoaded, setImgLoaded] = useState<boolean[]>(new Array(images.length).fill(false));
  const { ref: parallaxRef, offset } = useParallax(0.15);

  useEffect(() => {
    if (!api) return;
    api.on("select", () => setActiveIndex(api.selectedScrollSnap()));
  }, [api]);

  const handleImgLoad = useCallback((idx: number) => {
    setImgLoaded(prev => { const n = [...prev]; n[idx] = true; return n; });
  }, []);

  const handleThumbClick = (idx: number) => {
    api?.scrollTo(idx);
  };

  return (
    <div className="w-full space-y-3" ref={parallaxRef}>
      <div className="relative overflow-hidden" style={{ transform: `translateY(${offset}px)`, willChange: 'transform' }}>
        <Carousel className="w-full" setApi={setApi}>
          <CarouselContent>
            {images.map((img, index) => (
              <CarouselItem key={index} className="relative">
                <div className="aspect-square bg-muted rounded-2xl overflow-hidden">
                  {!imgLoaded[index] && <div className="absolute inset-0 bg-muted animate-pulse rounded-2xl" />}
                  <img
                    src={img}
                    alt={productName}
                    className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded[index] ? 'opacity-100' : 'opacity-0'}`}
                    loading={index === 0 ? "eager" : "lazy"}
                    onLoad={() => handleImgLoad(index)}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>

        {/* Badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          {discountPercent && discountPercent > 0 && (
            <span className="bg-destructive text-destructive-foreground px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow animate-scale-bounce">
              <Tag className="w-3 h-3" /> {discountPercent}%-
            </span>
          )}
          {isNew && (
            <span className="bg-primary text-primary-foreground px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow animate-scale-bounce" style={{ animationDelay: '100ms' }}>
              <Sparkles className="w-3 h-3" /> جديد
            </span>
          )}
          {isLowStock && stockQuantity && (
            <span className="bg-warning text-warning-foreground px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow animate-scale-bounce" style={{ animationDelay: '200ms' }}>
              <Flame className="w-3 h-3" /> آخر {stockQuantity}
            </span>
          )}
          {isOutOfStock && (
            <span className="bg-muted text-muted-foreground px-2.5 py-1 rounded-lg text-xs font-bold shadow animate-scale-bounce" style={{ animationDelay: '150ms' }}>
              نفذ المخزون
            </span>
          )}
        </div>

        {/* Dots indicator */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => handleThumbClick(idx)}
                className={`rounded-full transition-all duration-300 ${
                  idx === activeIndex 
                    ? 'w-6 h-2 bg-primary' 
                    : 'w-2 h-2 bg-foreground/30'
                }`}
              />
            ))}
          </div>
        )}
      </Carousel>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 justify-center px-2">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => handleThumbClick(idx)}
              className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                idx === activeIndex 
                  ? 'border-primary ring-1 ring-primary/30' 
                  : 'border-border/50 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductImages;
