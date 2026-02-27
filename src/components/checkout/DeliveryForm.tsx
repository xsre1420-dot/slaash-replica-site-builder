import { User, Phone, MapPin, Home, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DeliveryFormProps {
  customerInfo: { name: string; phone: string; address: string; notes: string };
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  selectedGovernorate: string;
  onGovernorateChange: (v: string) => void;
  deliveryPrices?: { governorate: string; price: number }[];
  formErrors: Record<string, string>;
}

const DeliveryForm = ({
  customerInfo, onInputChange, selectedGovernorate, onGovernorateChange, deliveryPrices, formErrors,
}: DeliveryFormProps) => {
  const fieldClass = (field: string) =>
    cn(
      "text-right border-2 rounded-xl text-foreground bg-muted/30 pr-10 transition-all duration-200",
      formErrors[field]
        ? "border-destructive focus:border-destructive animate-[shake_0.3s_ease-in-out]"
        : "border-border focus:border-primary"
    );

  return (
    <div className="space-y-4">
      <IconField icon={User} label="الاسم" error={formErrors.name}>
        <Input name="name" value={customerInfo.name} onChange={onInputChange}
          className={fieldClass("name")} placeholder="أدخل اسمك الكامل" autoComplete="name" />
      </IconField>

      <IconField icon={Phone} label="رقم الهاتف" error={formErrors.phone}>
        <Input name="phone" type="tel" inputMode="tel" value={customerInfo.phone} onChange={onInputChange}
          className={cn(fieldClass("phone"), "pl-10 pr-3")} placeholder="07xx xxx xxxx" autoComplete="tel" dir="ltr" />
      </IconField>

      {deliveryPrices && deliveryPrices.length > 0 && (
        <IconField icon={MapPin} label="المحافظة" error={formErrors.governorate}>
          <Select value={selectedGovernorate} onValueChange={onGovernorateChange}>
            <SelectTrigger className={cn("text-right rounded-xl pr-10", formErrors.governorate ? "border-destructive" : "border-border")}>
              <SelectValue placeholder="اختر المحافظة" />
            </SelectTrigger>
            <SelectContent>
              {deliveryPrices.map((d, i) => (
                <SelectItem key={i} value={d.governorate}>{d.governorate}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </IconField>
      )}

      <IconField icon={Home} label="العنوان" error={formErrors.address}>
        <Input name="address" value={customerInfo.address} onChange={onInputChange}
          className={fieldClass("address")} placeholder="أدخل عنوانك بالتفصيل" autoComplete="street-address" />
      </IconField>

      <IconField icon={FileText} label="ملاحظات (اختياري)" required={false}>
        <Textarea name="notes" value={customerInfo.notes} onChange={onInputChange}
          className="text-right border-2 border-border rounded-xl text-foreground bg-muted/30 pr-10 focus:border-primary transition-all duration-200"
          placeholder="أي ملاحظات خاصة بالطلب" />
      </IconField>
    </div>
  );
};

const IconField = ({
  icon: Icon, label, error, required = true, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div className="text-right">
    <Label className="block mb-1.5 text-foreground text-sm">
      {label} {required && <span className="text-destructive">*</span>}
    </Label>
    <div className="relative">
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10 pointer-events-none">
        <Icon className="w-4 h-4" />
      </div>
      {children}
    </div>
    {error && <p className="text-destructive text-xs mt-1 animate-fade-in">{error}</p>}
  </div>
);

export default DeliveryForm;
