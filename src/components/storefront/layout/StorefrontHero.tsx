import { resolveMediaDeliveryUrl } from '@/utils/cdnMediaUtils';
import { cn } from '@/lib/utils';

interface StorefrontHeroProps {
  storeName: string;
  bannerImages: string[];
  currentIndex: number;
  isTransitioning: boolean;
  onDotClick: (index: number) => void;
}

const StorefrontHero = ({
  storeName,
  bannerImages,
  currentIndex,
  isTransitioning,
  onDotClick,
}: StorefrontHeroProps) => {
  if (bannerImages.length === 0) {
    return (
      <section className="sf-container pt-6 pb-2">
        <div className="relative overflow-hidden rounded-2xl sf-hero-gradient min-h-[200px] sm:min-h-[260px] flex items-end p-6 sm:p-8">
          <div className="relative z-10 text-right space-y-2 max-w-md mr-auto ml-0">
            <p className="sf-caption font-semibold uppercase tracking-widest text-primary/70">مرحباً بك</p>
            <h1 className="sf-display">{storeName}</h1>
            <p className="sf-body max-w-sm">
              تسوق بثقة — منتجات مختارة وتوصيل سريع
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="sf-container pt-6 pb-2">
      <div className="relative overflow-hidden rounded-2xl min-h-[220px] sm:min-h-[300px] lg:min-h-[360px] ring-1 ring-border/30">
        <div
          className={cn(
            'absolute inset-0 transition-opacity duration-700 ease-out',
            isTransitioning ? 'opacity-0' : 'opacity-100'
          )}
        >
          <img
            src={resolveMediaDeliveryUrl(bannerImages[currentIndex], { variant: 'display' })}
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/55 via-foreground/10 to-transparent pointer-events-none" />

        <div className="absolute bottom-0 inset-x-0 p-6 sm:p-8 text-right pointer-events-none">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight leading-tight">
            {storeName}
          </h1>
          <p className="text-sm text-white/80 max-w-sm mr-auto ml-0 mt-1.5 leading-relaxed">
            اكتشف مجموعتنا — جودة عالية وأسعار منافسة
          </p>
        </div>

        {bannerImages.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-auto">
            {bannerImages.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`الشريحة ${i + 1}`}
                onClick={() => onDotClick(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  currentIndex === i ? 'bg-white w-6' : 'bg-white/45 w-1.5 hover:bg-white/65'
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default StorefrontHero;
