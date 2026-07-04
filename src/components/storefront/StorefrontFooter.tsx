import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, MessageCircle, Package } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import {
  fetchFooterSuggestedForStorefront,
  type FooterSuggestedProduct,
} from "@/services/footerSuggestedProductsService";
import { cn } from "@/lib/utils";

interface StorefrontFooterProps {
  storeName: string;
  storeSlug?: string | null;
  ownerId?: string | null;
  governorate?: string;
  whatsappNumber?: string;
  returnPolicy?: string;
  privacyPolicy?: string;
  fullWidth?: boolean;
}

const StorefrontFooter = ({
  storeName,
  storeSlug,
  ownerId,
  governorate,
  whatsappNumber,
  returnPolicy,
  privacyPolicy,
  fullWidth = false,
}: StorefrontFooterProps) => {
  const home = storeSlug ? `/store/${storeSlug}` : '/preview';
  const [suggestedProducts, setSuggestedProducts] = useState<FooterSuggestedProduct[]>([]);

  useEffect(() => {
    let cancelled = false;

    void fetchFooterSuggestedForStorefront(storeSlug, ownerId).then((items) => {
      if (!cancelled) setSuggestedProducts(items);
    });

    return () => {
      cancelled = true;
    };
  }, [storeSlug, ownerId]);

  const productLink = (id: string) =>
    storeSlug ? `/store/${storeSlug}/product/${id}` : `/product-details/${id}`;

  return (
    <footer className="mt-auto w-full border-t border-border/60 bg-card/50">
      <div
        className={cn(
          "py-8 space-y-6",
          fullWidth ? "w-full px-4 sm:px-5" : "max-w-3xl mx-auto px-4"
        )}
      >
        <div className="text-center space-y-1">
          <p className="font-bold text-foreground">{storeName}</p>
          {governorate && (
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3" />
              {governorate}
            </p>
          )}
        </div>

        {suggestedProducts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground text-right">منتجات مقترحة</h3>
            <Carousel className="w-full" opts={{ align: "start", direction: "rtl" }}>
              <CarouselContent className="-mr-2">
                {suggestedProducts.map((product) => (
                  <CarouselItem key={product.id} className="pr-2 basis-[42%] sm:basis-[32%]">
                    <Link to={productLink(product.id)} className="block group">
                      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden transition-shadow hover:shadow-md">
                        <div className="aspect-square bg-muted relative overflow-hidden">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Package className="w-8 h-8 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                        <div className="p-2.5 space-y-1">
                          <p className="text-xs font-semibold text-foreground line-clamp-2 text-right leading-snug">
                            {product.name}
                          </p>
                          {product.short_description?.trim() && (
                            <p className="text-[10px] text-muted-foreground line-clamp-2 text-right leading-snug">
                              {product.short_description.trim()}
                            </p>
                          )}
                          <p className="text-xs font-bold text-primary text-right tabular-nums">
                            {product.price.toLocaleString()} د.ع
                          </p>
                        </div>
                      </div>
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
        )}

        {(returnPolicy || privacyPolicy) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {returnPolicy && (
              <div className="rounded-2xl border border-border/50 p-4 text-right">
                <h3 className="text-sm font-semibold text-foreground mb-2">سياسة الإرجاع</h3>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{returnPolicy}</p>
              </div>
            )}
            {privacyPolicy && (
              <div className="rounded-2xl border border-border/50 p-4 text-right">
                <h3 className="text-sm font-semibold text-foreground mb-2">الخصوصية</h3>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{privacyPolicy}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-medium text-green-700 bg-green-500/10 px-4 py-2 rounded-full hover:bg-green-500/15 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              تواصل عبر واتساب
            </a>
          )}
          <Link
            to={home}
            className="text-xs font-medium text-primary hover:underline"
          >
            العودة للمتجر
          </Link>
        </div>

        <p className="text-center text-[10px] text-muted-foreground">
          © {new Date().getFullYear()} {storeName} — تسوق آمن ومضمون
        </p>
      </div>
    </footer>
  );
};

export default StorefrontFooter;
