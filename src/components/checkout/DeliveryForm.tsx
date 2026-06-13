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
  deliveryFee?: number;
  formErrors: Record<string, string>;
}

const fieldIds = {
  name: "delivery-name",
  phone: "delivery-phone",
  governorate: "delivery-governorate",
  address: "delivery-address",
  notes: "delivery-notes",
} as const;

const DeliveryForm = ({
  customerInfo, onInputChange, selectedGovernorate, onGovernorateChange, deliveryPrices, deliveryFee = 0, formErrors,
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
      <IconField id={fieldIds.name} icon={User} label="الاسم" error={formErrors.name}>
        <Input
          id={fieldIds.name}
          name="name"
          value={customerInfo.name}
          onChange={onInputChange}
          className={fieldClass("name")}
          placeholder="أدخل اسمك الكامل"
          autoComplete="name"
          aria-invalid={!!formErrors.name}
          aria-describedby={formErrors.name ? `${fieldIds.name}-error` : undefined}
        />
      </IconField>

      <IconField id={fieldIds.phone} icon={Phone} label="رقم الهاتف" error={formErrors.phone}>
        <Input
          id={fieldIds.phone}
          name="phone"
          type="tel"
          inputMode="tel"
          value={customerInfo.phone}
          onChange={onInputChange}
          className={cn(fieldClass("phone"), "pl-10 pr-3")}
          placeholder="07xx xxx xxxx"
          autoComplete="tel"
          dir="ltr"
          aria-invalid={!!formErrors.phone}
          aria-describedby={formErrors.phone ? `${fieldIds.phone}-error` : undefined}
        />
      </IconField>

      {deliveryPrices && deliveryPrices.length > 0 && (
        <IconField id={fieldIds.governorate} icon={MapPin} label="المحافظة" error={formErrors.governorate}>
          <Select value={selectedGovernorate} onValueChange={onGovernorateChange}>
            <SelectTrigger
              id={fieldIds.governorate}
              className={cn("text-right rounded-xl pr-10", formErrors.governorate ? "border-destructive" : "border-border")}
              aria-invalid={!!formErrors.governorate}
              aria-describedby={formErrors.governorate ? `${fieldIds.governorate}-error` : undefined}
            >
              <SelectValue placeholder="اختر المحافظة" />
            </SelectTrigger>
            <SelectContent>
              {deliveryPrices.map((d, i) => (
                <SelectItem key={i} value={d.governorate}>
                  <span className="flex w-full justify-between gap-4">
                    <span>{d.governorate}</span>
                    <span className="text-muted-foreground text-xs">{d.price.toLocaleString()} د.ع</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedGovernorate && deliveryFee > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5 text-right">
              رسوم التوصيل: {deliveryFee.toLocaleString()} د.ع
            </p>
          )}
        </IconField>
      )}

      <IconField id={fieldIds.address} icon={Home} label="العنوان" error={formErrors.address}>
        <Input
          id={fieldIds.address}
          name="address"
          value={customerInfo.address}
          onChange={onInputChange}
          className={fieldClass("address")}
          placeholder="أدخل عنوانك بالتفصيل"
          autoComplete="street-address"
          aria-invalid={!!formErrors.address}
          aria-describedby={formErrors.address ? `${fieldIds.address}-error` : undefined}
        />
      </IconField>

      <IconField id={fieldIds.notes} icon={FileText} label="ملاحظات (اختياري)" required={false}>
        <Textarea
          id={fieldIds.notes}
          name="notes"
          value={customerInfo.notes}
          onChange={onInputChange}
          className="text-right border-2 border-border rounded-xl text-foreground bg-muted/30 pr-10 focus:border-primary transition-all duration-200"
          placeholder="أي ملاحظات خاصة بالطلب"
        />
      </IconField>
    </div>
  );
};

const IconField = ({
  id, icon: Icon, label, error, required = true, children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div className="text-right">
    <Label htmlFor={id} className="block mb-1.5 text-foreground text-sm">
      {label} {required && <span className="text-destructive">*</span>}
    </Label>
    <div className="relative">
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10 pointer-events-none">
        <Icon className="w-4 h-4" />
      </div>
      {children}
    </div>
    {error && (
      <p id={`${id}-error`} role="alert" className="text-destructive text-xs mt-1 animate-fade-in">
        {error}
      </p>
    )}
  </div>
);

export default DeliveryForm;
