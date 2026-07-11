import { Link } from "react-router-dom";
import { MapPin, MessageCircle } from "lucide-react";
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
