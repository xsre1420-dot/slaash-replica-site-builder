import { Link } from "react-router-dom";
import { MapPin, MessageCircle, Instagram, Facebook } from "lucide-react";
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
  governorate,
  whatsappNumber,
  returnPolicy,
  privacyPolicy,
  fullWidth = false,
}: StorefrontFooterProps) => {
  const home = storeSlug ? `/store/${storeSlug}` : '/preview';

  return (
    <footer className={cn('sf-footer', fullWidth && 'w-full')}>
      <div className={cn('py-12 sm:py-16', fullWidth ? 'sf-container' : 'sf-container')}>
        <div className="text-center mb-10 sm:mb-12">
          <p className="text-2xl sm:text-3xl font-bold tracking-tight">{storeName}</p>
          {governorate && (
            <p className="sf-footer-muted text-sm mt-2 flex items-center justify-center gap-2">
              <MapPin className="w-4 h-4 shrink-0" strokeWidth={2} />
              {governorate}
            </p>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-background/15 bg-background/5 text-background hover:bg-background/10 transition-colors"
              aria-label="واتساب"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
          )}
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-background/10 bg-background/5 text-background/40 cursor-not-allowed" aria-hidden>
            <Instagram className="w-4 h-4" />
          </span>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-background/10 bg-background/5 text-background/40 cursor-not-allowed" aria-hidden>
            <Facebook className="w-4 h-4" />
          </span>
        </div>

        <div className="grid gap-8 sm:grid-cols-3 text-right text-sm max-w-2xl mx-auto mb-10">
          <div className="space-y-2 text-center sm:text-right">
            <h4 className="font-semibold text-background/90">روابط</h4>
            <ul className="space-y-1.5 sf-footer-muted">
              <li><Link to={home}>الرئيسية</Link></li>
              <li><Link to={home}>المنتجات</Link></li>
            </ul>
          </div>
          {(returnPolicy || privacyPolicy) && (
            <div className="space-y-2 text-center sm:text-right sm:col-span-2">
              <h4 className="font-semibold text-background/90">السياسات</h4>
              {returnPolicy && (
                <p className="sf-footer-muted text-xs leading-relaxed line-clamp-3">{returnPolicy}</p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-background/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="sf-footer-muted text-xs order-2 sm:order-1">
            © {new Date().getFullYear()} {storeName}. جميع الحقوق محفوظة.
          </p>
          <Link to={home} className="text-xs font-medium text-background/80 hover:text-background order-1 sm:order-2 transition-colors">
            العودة للمتجر
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default StorefrontFooter;
