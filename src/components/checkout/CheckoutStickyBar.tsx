import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CheckoutStickyBarProps {
  cartCount: number;
  displayTotal: number;
  deliveryPending: boolean;
  isSubmitting: boolean;
  alertMessage?: string | null;
  onConfirm: () => void;
}

const CheckoutStickyBar = ({
  cartCount,
  displayTotal,
  deliveryPending,
  isSubmitting,
  alertMessage,
  onConfirm,
}: CheckoutStickyBarProps) => (
  <div
    className="fixed bottom-0 inset-x-0 z-50 md:hidden"
    dir="rtl"
  >
    {alertMessage && (
      <div
        role="alert"
        aria-live="assertive"
        className="flex items-center gap-2 border-t border-destructive/25 bg-destructive/12 px-4 py-2.5 text-destructive animate-in slide-in-from-bottom-2 duration-300"
      >
        <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2.25} />
        <div className="flex-1 min-w-0 text-right">
          <p className="text-[11px] font-bold leading-snug">أكمل بيانات الطلب</p>
          <p className="text-[10px] font-medium leading-snug text-destructive/90">{alertMessage}</p>
        </div>
      </div>
    )}
    <div className="border-t border-gray-100 bg-white/95 backdrop-blur-xl px-4 py-3 safe-area-bottom">
      <div className="flex items-center gap-3 max-w-2xl mx-auto">
        <div className="flex-1 min-w-0 text-right">
          <p className="text-xl font-bold tabular-nums text-gray-900 leading-tight">
            {displayTotal.toLocaleString()}{" "}
            <span className="text-sm font-semibold text-gray-500">د.ع</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {cartCount} {cartCount === 1 ? "منتج" : "منتجات"}
            {deliveryPending && " · + التوصيل لاحقاً"}
          </p>
        </div>
        <Button
          type="button"
          disabled={isSubmitting}
          onClick={onConfirm}
          className="h-11 min-w-[8.5rem] rounded-xl px-5 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_4px_14px_-2px_rgba(0,0,0,0.15)]"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "تأكيد الطلب"
          )}
        </Button>
      </div>
    </div>
  </div>
);

export default CheckoutStickyBar;
