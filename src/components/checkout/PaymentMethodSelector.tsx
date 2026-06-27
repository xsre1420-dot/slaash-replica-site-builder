import { Banknote, CreditCard, Wallet, Check } from "lucide-react";
import { PaymentMethodId, PaymentMethodOption } from "@/utils/paymentUtils";

const ICONS: Record<PaymentMethodId, typeof Banknote> = {
  cash_on_delivery: Banknote,
  credit_card: CreditCard,
  digital_wallet: Wallet,
};

interface PaymentMethodSelectorProps {
  methods: PaymentMethodOption[];
  selected: PaymentMethodId;
  onSelect: (method: PaymentMethodId) => void;
}

const PaymentMethodSelector = ({ methods, selected, onSelect }: PaymentMethodSelectorProps) => {
  if (methods.length === 0) {
    return (
      <p className="text-sm text-destructive text-right">
        لا توجد وسائل دفع مفعّلة لهذا المتجر
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {methods.map((method) => {
        const Icon = ICONS[method.id];
        const isSelected = selected === method.id;
        const disabled = !method.available;

        return (
          <button
            key={method.id}
            type="button"
            disabled={disabled}
            onClick={() => method.available && onSelect(method.id)}
            className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-all text-right ${
              isSelected
                ? 'border-primary bg-primary/5'
                : 'border-border/50 bg-card hover:border-primary/30'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-center gap-2">
              {isSelected && <Check className="w-4 h-4 text-primary" />}
              {disabled && (
                <span className="text-[10px] text-muted-foreground">قريباً</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{method.label}</p>
                <p className="text-xs text-muted-foreground">{method.description}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-foreground" />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default PaymentMethodSelector;
