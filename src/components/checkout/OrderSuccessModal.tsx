import { Check, PartyPopper } from "lucide-react";

interface OrderSuccessModalProps {
  orderId: string;
}

const OrderSuccessModal = ({ orderId }: OrderSuccessModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md animate-fade-in">
    <div className="bg-card border border-border rounded-2xl p-8 text-center max-w-sm mx-4 animate-scale-in">
      {/* Confetti-like dots */}
      <div className="relative">
        <div className="absolute -top-4 left-1/4 w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="absolute -top-6 right-1/3 w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "200ms" }} />
        <div className="absolute -top-3 right-1/4 w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "400ms" }} />
        <div className="absolute -top-5 left-1/3 w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "100ms" }} />
      </div>

      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-scale-in" style={{ animationDelay: "200ms" }}>
        <Check className="w-8 h-8 text-primary" />
      </div>

      <div className="flex items-center justify-center gap-2 mb-2">
        <PartyPopper className="w-5 h-5 text-primary animate-bounce" />
        <h3 className="text-xl font-bold text-foreground">تم تأكيد الطلب بنجاح!</h3>
      </div>

      <p className="text-muted-foreground text-sm mb-3">سيتم التواصل معك قريباً لتأكيد التوصيل</p>

      <div className="bg-muted/50 rounded-lg px-4 py-2 inline-block">
        <span className="text-xs text-muted-foreground">رقم الطلب: </span>
        <span className="text-sm font-bold text-foreground font-mono">{orderId}</span>
      </div>
    </div>
  </div>
);

export default OrderSuccessModal;
