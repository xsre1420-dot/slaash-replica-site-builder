
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Heart, Share2 } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { toast } from "sonner";

interface ProductHeaderProps {
  productId?: string;
  productName?: string;
}

const ProductHeader = ({ productId, productName }: ProductHeaderProps) => {
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFav = productId ? isFavorite(productId) : false;

  const handleShare = async () => {
    const shareData = {
      title: productName || 'منتج',
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("تم نسخ الرابط!");
      }
    } catch {}
  };

  const handleFavorite = () => {
    if (productId) {
      toggleFavorite(productId);
      toast.success(isFav ? "تمت الإزالة من المفضلة" : "تمت الإضافة إلى المفضلة", {
        icon: isFav ? '💔' : '❤️',
      });
    }
  };

  return (
    <div className="bg-card/90 backdrop-blur-xl p-3 sticky top-0 z-20 border-b border-border/50">
      <div className="flex justify-between items-center max-w-md mx-auto">
        <div className="flex items-center gap-2">
          {productId && (
            <>
              <button
                onClick={handleShare}
                className="w-10 h-10 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center text-muted-foreground hover:text-primary transition-all"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleFavorite}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isFav
                    ? 'bg-destructive/10 text-destructive scale-110'
                    : 'bg-muted hover:bg-muted/70 text-muted-foreground hover:text-destructive'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
              </button>
            </>
          )}
        </div>
        <h1 className="text-base font-bold text-foreground">تفاصيل المنتج</h1>
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default ProductHeader;
