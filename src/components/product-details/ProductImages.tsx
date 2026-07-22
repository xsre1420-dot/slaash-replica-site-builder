import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { buildResponsiveImageSources, resolveMediaDeliveryUrl } from '@/utils/cdnMediaUtils';
import { isImageUrlLoaded, markImageUrlLoaded } from '@/utils/imageLoadCache';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { Sparkles, Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import ProductImageLightbox from '@/components/storefront/ProductImageLightbox';
import { cn } from '@/lib/utils';

interface ProductImagesProps {
  images: string[];
  productName: string;
  tags?: string[];
  isLarge?: boolean;
  isNew?: boolean;
  isLowStock?: boolean;
  stockQuantity?: number;
  isOutOfStock?: boolean;
  galleryKey?: string;
}

type LoadState = 'loading' | 'loaded' | 'error';

const GallerySlideImage = ({
  src,
  alt,
  priority,
  onLoadState,
  zoomOnHover,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  onLoadState: (state: LoadState) => void;
  zoomOnHover?: boolean;
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [srcAttempt, setSrcAttempt] = useState(0);
  const sources = useMemo(() => buildResponsiveImageSources(src, { variant: 'display' }), [src]);
  const displaySrc = srcAttempt === 0 ? sources.src : src.trim();

  useEffect(() => {
    if (isImageUrlLoaded(displaySrc)) {
      onLoadState('loaded');
      return;
    }
    onLoadState('loading');
    setSrcAttempt(0);
  }, [src, displaySrc, onLoadState]);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      markImageUrlLoaded(displaySrc);
      onLoadState('loaded');
    }
  }, [displaySrc, onLoadState]);

  return (
    <img
      ref={imgRef}
      src={displaySrc}
      alt={alt}
      className={cn(
        'absolute inset-0 w-full h-full object-contain transition-transform duration-700 ease-out',
        zoomOnHover && 'lg:group-hover:scale-[1.06]'
      )}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      {...(priority ? { fetchPriority: 'high' as const } : {})}
      {...(srcAttempt === 0 && sources.srcSet ? { srcSet: sources.srcSet, sizes: sources.sizes } : {})}
      draggable={false}
      onLoad={() => {
        markImageUrlLoaded(displaySrc);
        onLoadState('loaded');
      }}
      onError={() => {
        if (srcAttempt === 0 && src.trim() !== displaySrc) {
          setSrcAttempt(1);
          onLoadState('loading');
          return;
        }
        onLoadState('error');
      }}
    />
  );
};

const ProductImages = ({
  images,
  productName,
  tags,
  isLarge = false,
  isNew,
  isLowStock,
  stockQuantity,
  isOutOfStock,
  galleryKey = 'default',
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
    () => `${galleryKey}:${safeImages.join('|')}`,
    [galleryKey, safeImages]
  );

  const hasMultiple = safeImages.length > 1;

  useEffect(() => {
    prevGalleryKey.current = galleryKey;
    setActiveIndex(0);
    setSlideStates((prev) =>
      safeImages.map((url, idx) => {
        const delivery = resolveMediaDeliveryUrl(url, { variant: 'display' });
        if (isImageUrlLoaded(delivery) || isImageUrlLoaded(url)) return 'loaded';
        return prev[idx] ?? 'loading';
      })
    );
    api?.scrollTo(0, true);
  }, [imageSignature, galleryKey, api, safeImages]);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setActiveIndex(api.selectedScrollSnap());
    onSelect();
    api.on('select', onSelect);
    return () => api.off('select', onSelect);
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

  const aspectClass = isLarge
    ? 'aspect-[4/5] sm:aspect-square lg:aspect-[4/5] w-full'
    : 'aspect-square w-full';

  const thumbButton = (img: string, idx: number, vertical = false) => (
    <button
      key={`thumb-${galleryKey}-${idx}`}
      type="button"
      role="tab"
      aria-selected={idx === activeIndex}
      onClick={() => handleThumbClick(idx)}
      aria-label={`صورة ${idx + 1}`}
      className={cn(
        'relative overflow-hidden transition-all duration-200 bg-card border-2',
        vertical ? 'w-full aspect-square rounded-xl' : 'shrink-0 w-[4.5rem] h-[4.5rem] rounded-xl',
        idx === activeIndex
          ? 'border-primary opacity-100 shadow-md ring-1 ring-primary/20'
          : 'border-border/40 opacity-70 hover:opacity-100 hover:border-primary/30'
      )}
    >
      <img
        src={resolveMediaDeliveryUrl(img, { variant: 'thumbnail' })}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
        width={72}
        height={72}
        draggable={false}
        onError={(e) => {
          e.currentTarget.src = img;
        }}
      />
    </button>
  );

  if (safeImages.length === 0) {
    return (
      <div className={cn(aspectClass, 'rounded-3xl flex items-center justify-center border border-border/40 bg-muted/20')}>
        <span className="text-sm text-muted-foreground">لا توجد صورة</span>
      </div>
    );
  }

  const mainStage = (
    <div className="relative group overflow-hidden rounded-3xl border border-border/40 bg-muted/10 shadow-xl shadow-foreground/[0.04]">
      <Carousel className="w-full" setApi={setApi} opts={{ loop: hasMultiple, align: 'start', direction: 'rtl', dragFree: false }}>
        <CarouselContent className="ml-0">
          {safeImages.map((img, index) => {
            const loadState = slideStates[index] ?? 'loading';
            const isNearActive = Math.abs(index - activeIndex) <= 1;
            return (
              <CarouselItem key={`${galleryKey}-${index}`} className="pl-0 basis-full">
                <div className={cn(aspectClass, 'relative overflow-hidden')}>
                  {loadState === 'loading' && isNearActive && (
                    <div className="absolute inset-0 sf-skeleton z-[1]" aria-hidden />
                  )}
                  {!isNearActive ? (
                    <div className="absolute inset-0 bg-muted/20 z-[1]" aria-hidden />
                  ) : loadState === 'error' ? (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm z-[2]">
                      تعذّر تحميل الصورة
                    </div>
                  ) : (
                    <ProductImageLightbox
                      src={img}
                      alt={`${productName} — صورة ${index + 1}`}
                      className="absolute inset-0 z-[2] overflow-hidden"
                      priority={index === 0}
                      renderImage={(lightboxProps) => (
                        <GallerySlideImage
                          src={img}
                          alt={lightboxProps.alt}
                          priority={index === 0}
                          zoomOnHover
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

      <div className="absolute top-4 right-4 flex flex-col gap-2 z-20 pointer-events-none">
        {isNew && (
          <span className="sf-badge bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="w-3 h-3 ml-0.5" /> جديد
          </span>
        )}
        {isLowStock && stockQuantity != null && (
          <span className="sf-badge bg-warning text-warning-foreground shadow-sm">
            <Flame className="w-3 h-3 ml-0.5" /> {stockQuantity}
          </span>
        )}
        {isOutOfStock && (
          <span className="sf-badge bg-foreground/80 text-background">نفذ المخزون</span>
        )}
      </div>

      {tags && tags.length > 0 && (
        <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-1.5 justify-end max-w-[60%] pointer-events-none">
          {tags.map((tag) => tag.trim()).filter(Boolean).map((tag) => (
            <span key={tag} className="sf-badge bg-card/95 text-foreground backdrop-blur-sm border border-border/30">
              {tag}
            </span>
          ))}
        </div>
      )}

      {hasMultiple && (
        <>
          <span className="absolute bottom-4 left-4 z-30 rounded-full bg-background/90 backdrop-blur-md text-foreground text-xs font-medium px-3 py-1 tabular-nums border border-border/30 shadow-sm">
            {activeIndex + 1} / {safeImages.length}
          </span>
          <button
            type="button"
            onClick={() => api?.scrollNext()}
            aria-label="الصورة التالية"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-30 sf-icon-btn h-11 w-11 bg-card/95 backdrop-blur-md shadow-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => api?.scrollPrev()}
            aria-label="الصورة السابقة"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-30 sf-icon-btn h-11 w-11 bg-card/95 backdrop-blur-md shadow-lg"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="w-full space-y-4">
      <div className="grid lg:grid-cols-[4.5rem_1fr] gap-3 lg:gap-4">
        {hasMultiple && (
          <div className="hidden lg:flex flex-col gap-2 order-1" role="tablist" aria-label="صور المنتج">
            {safeImages.map((img, idx) => thumbButton(img, idx, true))}
          </div>
        )}
        <div className={cn(hasMultiple ? 'order-2' : 'col-span-full')}>{mainStage}</div>
      </div>

      {hasMultiple && (
        <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x" role="tablist">
          {safeImages.map((img, idx) => thumbButton(img, idx, false))}
        </div>
      )}
    </div>
  );
};

export default ProductImages;
