import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { resolveMediaDeliveryUrl } from "@/utils/cdnMediaUtils";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Sparkles, Flame, Tag, ChevronLeft, ChevronRight } from "lucide-react";
import ProductImageLightbox from "@/components/storefront/ProductImageLightbox";
import { cn } from "@/lib/utils";

interface ProductImagesProps {
  images: string[];
  productName: string;
  isLarge?: boolean;
  isNew?: boolean;
  isLowStock?: boolean;
  stockQuantity?: number;
  isOutOfStock?: boolean;
  discountPercent?: number;
  galleryKey?: string;
}

type LoadState = "loading" | "loaded" | "error";

const GallerySlideImage = ({
  src,
  alt,
  priority,
  onLoadState,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  onLoadState: (state: LoadState) => void;
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [srcAttempt, setSrcAttempt] = useState(0);
  const displaySrc =
    srcAttempt === 0
      ? resolveMediaDeliveryUrl(src, { variant: "display" })
      : src.trim();

  useEffect(() => {
    onLoadState("loading");
    setSrcAttempt(0);
  }, [src, onLoadState]);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      onLoadState("loaded");
    }
  }, [displaySrc, onLoadState]);

  return (
    <img
      ref={imgRef}
      src={displaySrc}
      alt={alt}
      className="absolute inset-0 w-full h-full object-contain"
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onLoad={() => onLoadState("loaded")}
      onError={() => {
        if (srcAttempt === 0 && src.trim() !== displaySrc) {
          setSrcAttempt(1);
          onLoadState("loading");
          return;
        }
        onLoadState("error");
      }}
    />
  );
};

const ProductImages = ({
  images,
  productName,
  isLarge = false,
  isNew,
  isLowStock,
  stockQuantity,
  isOutOfStock,
  discountPercent,
  galleryKey = "default",
}: ProductImagesProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [api, setApi] = useState<CarouselApi>();
  const [slideStates, setSlideStates] = useState<LoadState[]>([]);
  const prevGalleryKey = useRef(galleryKey);

  const safeImages = useMemo(() => {
    const filtered = images.map((u) => u?.trim()).filter(Boolean) as string[];
    return filtered.length > 0 ? filtered : [];
  }, [images]);

  const imageSignature = useMemo(
    () => `${galleryKey}:${safeImages.join("|")}`,
    [galleryKey, safeImages]
  );

  const hasMultiple = safeImages.length > 1;

  useEffect(() => {
    prevGalleryKey.current = galleryKey;
    setActiveIndex(0);
    setSlideStates(new Array(safeImages.length).fill("loading"));
    api?.scrollTo(0, true);
  }, [imageSignature, galleryKey, api, safeImages.length]);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setActiveIndex(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  const setSlideState = useCallback((index: number, state: LoadState) => {
    setSlideStates((prev) => {
      if (prev[index] === state) return prev;
      const next = [...prev];
      next[index] = state;
      return next;
    });
  }, []);

  const handleThumbClick = (idx: number) => {
    setActiveIndex(idx);
    api?.scrollTo(idx);
  };

  const handlePrev = () => api?.scrollPrev();
  const handleNext = () => api?.scrollNext();

  const badges = (
    <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-20 pointer-events-none">
      {discountPercent != null && discountPercent > 0 && (
        <span className="bg-destructive text-destructive-foreground px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 shadow-sm">
          <Tag className="w-3 h-3" /> -{discountPercent}%
        </span>
      )}
      {isNew && (
        <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 shadow-sm">
          <Sparkles className="w-3 h-3" /> جديد
        </span>
      )}
      {isLowStock && stockQuantity != null && (
        <span className="bg-amber-500 text-white px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 shadow-sm">
          <Flame className="w-3 h-3" /> آخر {stockQuantity}
        </span>
      )}
      {isOutOfStock && (
        <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-md text-[11px] font-bold shadow-sm">
          نفذ المخزون
        </span>
      )}
    </div>
  );

  const aspectClass = isLarge
    ? "aspect-[4/3] sm:aspect-square lg:aspect-[4/5] w-full"
    : "aspect-square w-full";

  const thumbButton = (img: string, idx: number, vertical = false) => (
    <button
      key={`thumb-${galleryKey}-${idx}`}
      type="button"
      role="tab"
      aria-selected={idx === activeIndex}
      onClick={() => handleThumbClick(idx)}
      aria-label={`صورة ${idx + 1}`}
      className={cn(
        "relative overflow-hidden transition-all duration-200 bg-background border-2",
        vertical
          ? "w-full aspect-square rounded-lg"
          : "shrink-0 snap-start w-[4.25rem] h-[4.25rem] sm:w-20 sm:h-20 rounded-xl",
        idx === activeIndex
          ? "border-primary opacity-100 shadow-sm"
          : "border-transparent opacity-75 hover:opacity-100 hover:border-primary/40"
      )}
    >
      <img
        src={resolveMediaDeliveryUrl(img, { variant: "thumbnail" })}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={(e) => {
          e.currentTarget.src = img;
        }}
      />
    </button>
  );

  if (safeImages.length === 0) {
    return (
      <div className={cn(aspectClass, "rounded-2xl flex items-center justify-center border border-border/10")}>
        <span className="text-sm text-muted-foreground">لا توجد صورة</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-border/10 shadow-sm">
            <Carousel
              className="w-full"
              setApi={setApi}
              opts={{ loop: hasMultiple, align: "start", direction: "rtl", dragFree: false }}
            >
              <CarouselContent className="-ml-0">
                {safeImages.map((img, index) => {
                  const loadState = slideStates[index] ?? "loading";
                  return (
                    <CarouselItem key={`${galleryKey}-${index}`} className="pl-0 basis-full">
                      <div className={cn(aspectClass, "relative overflow-hidden")}>
                        {loadState === "loading" && (
                          <div className="absolute inset-0 bg-muted/50 animate-pulse z-[1]" aria-hidden />
                        )}
                        {loadState === "error" ? (
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm z-[2]">
                            تعذّر تحميل الصورة
                          </div>
                        ) : (
                          <ProductImageLightbox
                            src={img}
                            alt={`${productName} — صورة ${index + 1}`}
                            className="absolute inset-0 z-[2]"
                            priority={index === 0}
                            renderImage={(lightboxProps) => (
                              <GallerySlideImage
                                src={img}
                                alt={lightboxProps.alt}
                                priority={index === 0}
                                onLoadState={(state) => setSlideState(index, state)}
                              />
                            )}
                          />
                        )}
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
            </Carousel>

            {badges}

            {hasMultiple && (
              <>
                <span className="absolute top-3 left-3 z-30 rounded-full bg-background/90 backdrop-blur-sm text-foreground text-[11px] font-medium px-2.5 py-1 tabular-nums border border-border/20 shadow-sm">
                  {activeIndex + 1} / {safeImages.length}
                </span>

                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="الصورة التالية"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-11 h-11 flex items-center justify-center rounded-full bg-background/95 backdrop-blur-sm border border-border/20 shadow-md text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="الصورة السابقة"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-11 h-11 flex items-center justify-center rounded-full bg-background/95 backdrop-blur-sm border border-border/20 shadow-md text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

      {hasMultiple && (
        <div
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory"
          role="tablist"
          aria-label="صور المنتج"
        >
          {safeImages.map((img, idx) => thumbButton(img, idx, false))}
        </div>
      )}
    </div>
  );
};

export default ProductImages;
