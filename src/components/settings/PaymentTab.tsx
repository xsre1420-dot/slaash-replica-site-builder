
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  {
    key: "paymentCashOnDelivery" as const,
    label: "الدفع عند الاستلام",
    description: "يدفع العميل نقداً عند استلام الطلب",
    icon: Banknote,
  },
  {
    key: "paymentCreditCard" as const,
    label: "بطاقة ائتمان",
    description: "الدفع عبر بطاقة فيزا أو ماستركارد",
    icon: CreditCard,
  },
  {
    key: "paymentEwallet" as const,
    label: "محفظة إلكترونية",
    description: "الدفع عبر المحافظ الإلكترونية (زين كاش، آسيا حوالة...)",
    icon: Wallet,
  },
];

const PaymentTab = ({ settings, setSettings }: PaymentTabProps) => {
  return (
    <Card className="border-0 shadow-none bg-muted/50 rounded-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-foreground/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <CardTitle className="text-right text-xl text-foreground">وسائل الدفع</CardTitle>
            <CardDescription className="text-right text-muted-foreground">
              تفعيل أو تعطيل طرق الدفع المتاحة في متجرك
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {paymentMethods.map((method) => {
          const Icon = method.icon;
          return (
            <div
              key={method.key}
              className="flex items-center justify-between p-5 bg-background rounded-xl border border-border"
            >
              <Switch
                checked={settings[method.key]}
                onCheckedChange={(checked) =>
                  setSettings((prev: any) => ({ ...prev, [method.key]: checked }))
                }
              />
              <div className="flex items-center gap-3 flex-1 justify-end">
                <div className="text-right">
                  <Label className="text-foreground font-medium text-base">{method.label}</Label>
                  <p className="text-sm text-muted-foreground">{method.description}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Icon className="w-5 h-5 text-foreground" />
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default PaymentTab;
