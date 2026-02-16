
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="border-0 shadow-none bg-muted/50 rounded-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <CardTitle className="text-right text-xl text-foreground">إعدادات الواتساب</CardTitle>
            <CardDescription className="text-right text-muted-foreground">
              إعداد رسائل واتساب التلقائية لمتجرك
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-right block text-foreground font-medium">رقم الواتساب</Label>
          <Input
            value={settings.whatsappNumber}
            onChange={(e) => setSettings((prev: any) => ({ ...prev, whatsappNumber: e.target.value }))}
            className="text-left rounded-xl text-foreground"
            placeholder="964XXXXXXXXXX"
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground text-right">أدخل الرقم بالصيغة الدولية بدون + (مثال: 964XXXXXXXXXX)</p>
        </div>

        <div className="space-y-3">
          <Label className="text-right block text-foreground font-medium">رسالة الترحيب</Label>
          <Textarea
            value={settings.whatsappWelcomeMessage}
            onChange={(e) => setSettings((prev: any) => ({ ...prev, whatsappWelcomeMessage: e.target.value }))}
            className="min-h-[100px] rounded-xl text-right text-foreground"
            placeholder="مرحباً بك في متجرنا! كيف يمكننا مساعدتك؟"
            dir="rtl"
          />
        </div>

        <div className="space-y-3">
          <Label className="text-right block text-foreground font-medium">رسالة تأكيد الطلب</Label>
          <Textarea
            value={settings.whatsappOrderConfirmation}
            onChange={(e) => setSettings((prev: any) => ({ ...prev, whatsappOrderConfirmation: e.target.value }))}
            className="min-h-[100px] rounded-xl text-right text-foreground"
            placeholder="شكراً لطلبك! تم استلام طلبك رقم {order_id} وسيتم التواصل معك قريباً."
            dir="rtl"
          />
          <p className="text-xs text-muted-foreground text-right">
            يمكنك استخدام {"{order_id}"} لإدراج رقم الطلب و {"{customer_name}"} لاسم العميل
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppTab;
