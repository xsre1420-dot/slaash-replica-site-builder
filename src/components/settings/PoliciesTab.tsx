import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, RotateCcw, Scale, Shield } from "lucide-react";

interface PoliciesTabProps {
  settings: {
    returnPolicy: string;
    termsConditions: string;
    privacyPolicy: string;
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

const policies = [
  { key: "returnPolicy" as const, label: "سياسة الإرجاع والاستبدال", icon: RotateCcw, placeholder: "يمكن إرجاع المنتج خلال 7 أيام من تاريخ الاستلام بشرط أن يكون بحالته الأصلية..." },
  { key: "termsConditions" as const, label: "الشروط والأحكام", icon: Scale, placeholder: "باستخدامك لهذا المتجر فأنت توافق على الشروط والأحكام التالية..." },
  { key: "privacyPolicy" as const, label: "سياسة الخصوصية", icon: Shield, placeholder: "نحن نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية..." },
];

const PoliciesTab = ({ settings, setSettings }: PoliciesTabProps) => {
  return (
    <div className="space-y-4">
      {policies.map((policy) => {
        const Icon = policy.icon;
        return (
          <div key={policy.key} className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 justify-end">
              <Label className="text-foreground font-bold">{policy.label}</Label>
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <Textarea
              value={settings[policy.key]}
              onChange={(e) => setSettings((prev: any) => ({ ...prev, [policy.key]: e.target.value }))}
              className="min-h-[100px] rounded-xl text-right text-foreground bg-muted/30"
              placeholder={policy.placeholder}
              dir="rtl"
            />
          </div>
        );
      })}
    </div>
  );
};

export default PoliciesTab;
