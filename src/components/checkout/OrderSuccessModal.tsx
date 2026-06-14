import { Check, PartyPopper, ArrowLeft, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getStoreHomePath } from "@/lib/storefrontPaths";

interface OrderSuccessModalProps {
  orderId: string;
  storeSlug?: string | null;
  whatsappNumber?: string;
}

const OrderSuccessModal = ({ orderId, storeSlug, whatsappNumber }: OrderSuccessModalProps) => {
  const home = getStoreHomePath(storeSlug);
  const waLink = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(`مرحباً، أريد متابعة طلبي رقم ${orderId}`)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md animate-fade-in p-4">
      <div className="bg-card border border-border rounded-2xl p-8 text-center max-w-sm w-full animate-scale-in shadow-xl">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-primary" />
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <PartyPopper className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold text-foreground">تم تأكيد طلبك!</h3>
        </div>

        <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
          شكراً لثقتك. سنتواصل معك قريباً لتأكيد التوصيل.
        </p>

        <div className="bg-muted/50 rounded-xl px-4 py-3 mb-6">
          <span className="text-xs text-muted-foreground">رقم الطلب </span>
          <span className="text-sm font-bold text-foreground font-mono block mt-1">{orderId}</span>
        </div>

        <div className="flex flex-col gap-2">
          <Link to={home}>
            <Button className="w-full rounded-xl font-semibold">
              <ArrowLeft className="w-4 h-4 ml-2" />
              متابعة التسوق
            </Button>
          </Link>
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full rounded-xl border-green-500/30 text-green-700 hover:bg-green-500/5">
                <MessageCircle className="w-4 h-4 ml-2" />
                متابعة عبر واتساب
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderSuccessModal;
