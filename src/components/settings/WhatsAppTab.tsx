import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle } from "lucide-react";

interface WhatsAppTabProps {
  settings: {
    whatsappNumber: string;
    whatsappWelcomeMessage: string;
    whatsappOrderConfirmation: string;
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

const WhatsAppTab = ({ settings, setSettings }: WhatsAppTabProps) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-2 justify-end">
        <h3 className="text-lg font-bold text-foreground">إعدادات الواتساب</h3>
        <MessageCircle className="w-5 h-5 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <Label className="text-right block text-foreground font-medium text-sm">رقم الواتساب</Label>
        <Input
          value={settings.whatsappNumber}
          onChange={(e) => setSettings((prev: any) => ({ ...prev, whatsappNumber: e.target.value }))}
          className="text-left rounded-xl text-foreground"
          placeholder="964XXXXXXXXXX"
          dir="ltr"
        />
        <p className="text-xs text-muted-foreground text-right">الصيغة الدولية بدون + (مثال: 964XXXXXXXXXX)</p>
      </div>

      <div className="space-y-2">
        <Label className="text-right block text-foreground font-medium text-sm">رسالة الترحيب</Label>
        <Textarea
          value={settings.whatsappWelcomeMessage}
          onChange={(e) => setSettings((prev: any) => ({ ...prev, whatsappWelcomeMessage: e.target.value }))}
          className="min-h-[80px] rounded-xl text-right text-foreground"
          placeholder="مرحباً بك في متجرنا! كيف يمكننا مساعدتك؟"
          dir="rtl"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-right block text-foreground font-medium text-sm">رسالة تأكيد الطلب</Label>
        <Textarea
          value={settings.whatsappOrderConfirmation}
          onChange={(e) => setSettings((prev: any) => ({ ...prev, whatsappOrderConfirmation: e.target.value }))}
          className="min-h-[80px] rounded-xl text-right text-foreground"
          placeholder="شكراً لطلبك! تم استلام طلبك رقم {order_id} وسيتم التواصل معك قريباً."
          dir="rtl"
        />
        <p className="text-xs text-muted-foreground text-right">
          استخدم {"{order_id}"} لرقم الطلب و {"{customer_name}"} لاسم العميل
        </p>
      </div>
    </div>
  );
};

export default WhatsAppTab;
