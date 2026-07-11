import { AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckoutValidationAlertProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

const CheckoutValidationAlert = ({
  message,
  onDismiss,
  className,
}: CheckoutValidationAlertProps) => (
  <div
    role="alert"
    aria-live="assertive"
    className={cn(
      "flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-destructive animate-in fade-in slide-in-from-top-2 duration-300",
      className
    )}
  >
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
    <div className="flex-1 min-w-0 text-right">
      <p className="text-sm font-bold leading-snug">أكمل بيانات الطلب</p>
      <p className="text-xs font-medium mt-0.5 text-destructive/90">{message}</p>
    </div>
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        aria-label="إغلاق التنبيه"
        className="shrink-0 rounded-lg p-1 hover:bg-destructive/10 transition-colors"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    )}
  </div>
);

export default CheckoutValidationAlert;
