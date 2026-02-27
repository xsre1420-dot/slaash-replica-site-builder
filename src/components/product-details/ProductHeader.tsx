
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
    <div className="bg-card/95 backdrop-blur-md p-4 sticky top-0 z-20 border-b border-border/50">
      <div className="flex justify-between items-center max-w-md mx-auto">
        <div className="flex items-center gap-2">
          {productId && (
            <>
              <button
                onClick={handleShare}
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleFavorite}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                  isFav 
                    ? 'bg-destructive/10 text-destructive scale-110' 
                    : 'bg-muted text-muted-foreground hover:text-destructive'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
              </button>
            </>
          )}
        </div>
        <h1 className="text-lg font-bold text-foreground">تفاصيل المنتج</h1>
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default ProductHeader;
