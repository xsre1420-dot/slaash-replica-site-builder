import { Check, PartyPopper, ArrowLeft, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getStoreHomePath } from "@/lib/storefrontPaths";

interface OrderSuccessModalProps {
  orderId: string;
  storeSlug?: string | null;
  whatsappNumber?: string;
  onDismiss: () => void;
}

const OrderSuccessModal = ({ orderId, storeSlug, whatsappNumber, onDismiss }: OrderSuccessModalProps) => {
  const navigate = useNavigate();
  const home = getStoreHomePath(storeSlug);
  const waLink = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(`مرحباً، أريد متابعة طلبي رقم ${orderId}`)}`
    : null;

  const handleContinueShopping = () => {
    onDismiss();
    navigate(home);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in p-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center max-w-sm w-full animate-scale-in shadow-xl">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-primary" />
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <PartyPopper className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold text-gray-900">تم تأكيد طلبك!</h3>
        </div>

        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          شكراً لثقتك. سنتواصل معك قريباً لتأكيد التوصيل.
        </p>

        <div className="flex flex-col gap-2">
          <Button type="button" onClick={handleContinueShopping} className="w-full rounded-xl font-semibold">
            <ArrowLeft className="w-4 h-4 ml-2" />
            متابعة التسوق
          </Button>
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer" onClick={onDismiss}>
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
