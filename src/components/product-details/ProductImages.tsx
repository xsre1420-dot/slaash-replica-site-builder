
import { useState, useCallback, useEffect } from "react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Sparkles, Flame, Tag } from "lucide-react";
import ProductImageLightbox from "@/components/storefront/ProductImageLightbox";

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
  images,
  productName,
  isLarge = false,
  isNew,
  isLowStock,
  stockQuantity,
  isOutOfStock,
  discountPercent,
}: ProductImagesProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [api, setApi] = useState<CarouselApi>();
  const [imgLoaded, setImgLoaded] = useState<boolean[]>(new Array(images.length).fill(false));

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setActiveIndex(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  const handleImgLoad = useCallback((idx: number) => {
    setImgLoaded((prev) => {
      const next = [...prev];
      next[idx] = true;
      return next;
    });
  }, []);

  const handleThumbClick = (idx: number) => {
    setActiveIndex(idx);
    api?.scrollTo(idx);
  };

  const badges = (
    <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
      {discountPercent && discountPercent > 0 && (
        <span className="bg-destructive text-destructive-foreground px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow">
          <Tag className="w-3 h-3" /> -{discountPercent}%
        </span>
      )}
      {isNew && (
        <span className="bg-primary text-primary-foreground px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow">
          <Sparkles className="w-3 h-3" /> جديد
        </span>
      )}
      {isLowStock && stockQuantity && (
        <span className="bg-warning text-warning-foreground px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow">
          <Flame className="w-3 h-3" /> آخر {stockQuantity}
        </span>
      )}
      {isOutOfStock && (
        <span className="bg-muted text-muted-foreground px-2.5 py-1 rounded-lg text-xs font-bold shadow">
          نفذ المخزون
        </span>
      )}
    </div>
  );

  const mainImageBlock = (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-muted/30 shadow-sm">
      <Carousel className="w-full" setApi={setApi}>
        <CarouselContent>
          {images.map((img, index) => (
            <CarouselItem key={index} className="relative">
              <div className={`${isLarge ? "aspect-square lg:aspect-[4/5]" : "aspect-square"} bg-muted overflow-hidden`}>
                {!imgLoaded[index] && <div className="absolute inset-0 bg-muted animate-pulse" />}
                <ProductImageLightbox
                  src={img}
                  alt={`${productName} — صورة ${index + 1}`}
                  className={`transition-opacity duration-500 ${imgLoaded[index] ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => handleImgLoad(index)}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {badges}

      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 lg:hidden">
          {images.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleThumbClick(idx)}
              aria-label={`صورة ${idx + 1}`}
              className={`rounded-full transition-all duration-300 ${
                idx === activeIndex ? "w-6 h-2 bg-primary" : "w-2 h-2 bg-foreground/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );

  const thumbButton = (img: string, idx: number, className: string) => (
    <button
      key={idx}
      type="button"
      onClick={() => handleThumbClick(idx)}
      aria-label={`عرض صورة ${idx + 1}`}
      className={`overflow-hidden border-2 transition-all shrink-0 ${className} ${
        idx === activeIndex
          ? "border-primary ring-2 ring-primary/20 opacity-100"
          : "border-border/50 opacity-70 hover:opacity-100 hover:border-primary/30"
      }`}
    >
      <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
    </button>
  );

  return (
    <div className="w-full">
      {/* Desktop: main image + vertical thumbnails */}
      <div className="hidden lg:grid lg:grid-cols-[72px_minmax(0,1fr)] lg:gap-3">
        <div className="flex flex-col gap-2 max-h-[min(70vh,640px)] overflow-y-auto pe-1">
          {images.map((img, idx) =>
            thumbButton(img, idx, "w-[72px] h-[72px] rounded-xl")
          )}
        </div>
        {mainImageBlock}
      </div>

      {/* Mobile: main image + horizontal thumbnails */}
      <div className="lg:hidden space-y-3">
        {mainImageBlock}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {images.map((img, idx) =>
              thumbButton(img, idx, "w-16 h-16 rounded-xl")
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductImages;
