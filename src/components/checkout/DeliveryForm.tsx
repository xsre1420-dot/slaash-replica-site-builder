import { memo } from "react";
import { User, Phone, Home, FileText, Check } from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const DeliveryForm = memo(function DeliveryForm({
  customerInfo, onInputChange, selectedGovernorate, onGovernorateChange, deliveryPrices, deliveryFee = 0, formErrors,
}: DeliveryFormProps) {
  const fieldClass = (field: string, padding?: string) =>
    cn(
      "text-right rounded-xl text-sm text-gray-900 bg-white h-10 transition-all duration-200 border-gray-200",
      padding ?? "pr-9 pl-3",
      formErrors[field]
        ? "border-destructive focus:border-destructive animate-[shake_0.3s_ease-in-out]"
        : "border focus:border-primary focus-visible:ring-primary/20"
    );

  return (
    <div className="space-y-3">
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
          className={cn(fieldClass("phone", "pr-10 pl-3"), "text-right placeholder:text-right")}
          placeholder="07xx xxx xxxx"
          autoComplete="tel"
          dir="ltr"
          aria-invalid={!!formErrors.phone}
          aria-describedby={formErrors.phone ? `${fieldIds.phone}-error` : undefined}
        />
      </IconField>

      {deliveryPrices && deliveryPrices.length > 0 && (
        <div className="text-right">
          <div dir="rtl" className="mb-1.5 flex items-center justify-between gap-3">
            <Label htmlFor={fieldIds.governorate} className="text-xs font-medium text-foreground">
              المحافظة <span className="text-destructive">*</span>
            </Label>
            {selectedGovernorate && (
              <div className="flex items-center gap-1.5 text-[11px] shrink-0">
                <span className="text-muted-foreground">رسوم التوصيل</span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    deliveryFee > 0 ? "text-foreground" : "text-emerald-600"
                  )}
                >
                  {deliveryFee > 0 ? `${deliveryFee.toLocaleString()} د.ع` : "مجاني"}
                </span>
              </div>
            )}
          </div>
          <Select value={selectedGovernorate} onValueChange={onGovernorateChange}>
            <SelectTrigger
              id={fieldIds.governorate}
              dir="rtl"
              className={cn(
                "h-10 text-right rounded-xl px-3 bg-white border-gray-200",
                formErrors.governorate ? "border-destructive" : "border"
              )}
              aria-invalid={!!formErrors.governorate}
              aria-describedby={formErrors.governorate ? `${fieldIds.governorate}-error` : undefined}
            >
              <SelectValue placeholder="اختر المحافظة" />
            </SelectTrigger>
            <SelectContent dir="rtl" className="font-arabic">
              {deliveryPrices.map((d) => (
                <SelectPrimitive.Item
                  key={d.governorate}
                  value={d.governorate}
                  className="relative flex w-full cursor-default select-none items-center rounded-lg py-2.5 pr-8 pl-3 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-4 w-4 text-primary" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText className="flex-1 text-right truncate">
                    {d.governorate}
                  </SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectContent>
          </Select>
          {formErrors.governorate && (
            <p id={`${fieldIds.governorate}-error`} role="alert" className="text-destructive text-xs mt-1 animate-fade-in">
              {formErrors.governorate}
            </p>
          )}
        </div>
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
          className="text-right border border-gray-200 rounded-xl text-sm text-gray-900 bg-white pr-9 min-h-[72px] focus:border-primary focus-visible:ring-primary/20 transition-all duration-200"
          placeholder="أي ملاحظات خاصة بالطلب"
        />
      </IconField>
    </div>
  );
});

const IconField = ({
  id, icon: Icon, label, error, required = true, iconPosition = "right", children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  error?: string;
  required?: boolean;
  iconPosition?: "left" | "right";
  children: React.ReactNode;
}) => (
  <div className="text-right">
    <Label htmlFor={id} className="block mb-1 text-foreground text-xs font-medium">
      {label} {required && <span className="text-destructive">*</span>}
    </Label>
    <div className="relative">
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 text-primary z-10 pointer-events-none",
          iconPosition === "left" ? "left-3" : "right-3"
        )}
      >
        <Icon className="w-4 h-4" strokeWidth={2.25} />
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
