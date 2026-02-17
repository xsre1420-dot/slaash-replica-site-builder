import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CreditCard, Banknote, Wallet } from "lucide-react";

interface PaymentTabProps {
  settings: {
    paymentCashOnDelivery: boolean;
    paymentCreditCard: boolean;
    paymentEwallet: boolean;
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

const paymentMethods = [
  { key: "paymentCashOnDelivery" as const, label: "الدفع عند الاستلام", description: "يدفع العميل نقداً عند استلام الطلب", icon: Banknote },
  { key: "paymentCreditCard" as const, label: "بطاقة ائتمان", description: "الدفع عبر بطاقة فيزا أو ماستركارد", icon: CreditCard },
  { key: "paymentEwallet" as const, label: "محفظة إلكترونية", description: "زين كاش، آسيا حوالة...", icon: Wallet },
];

const PaymentTab = ({ settings, setSettings }: PaymentTabProps) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-2 justify-end">
        <h3 className="text-lg font-bold text-foreground">وسائل الدفع</h3>
        <CreditCard className="w-5 h-5 text-muted-foreground" />
      </div>

      <div className="space-y-3">
        {paymentMethods.map((method) => {
          const Icon = method.icon;
          return (
            <div key={method.key} className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border">
              <Switch
                checked={settings[method.key]}
                onCheckedChange={(checked) => setSettings((prev: any) => ({ ...prev, [method.key]: checked }))}
              />
              <div className="flex items-center gap-3 flex-1 justify-end">
                <div className="text-right">
                  <Label className="text-foreground font-medium">{method.label}</Label>
                  <p className="text-xs text-muted-foreground">{method.description}</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center">
                  <Icon className="w-4 h-4 text-foreground" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PaymentTab;
