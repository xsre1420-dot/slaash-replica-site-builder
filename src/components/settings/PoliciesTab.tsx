
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";

interface PoliciesTabProps {
  settings: {
    returnPolicy: string;
    termsConditions: string;
    privacyPolicy: string;
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

const PoliciesTab = ({ settings, setSettings }: PoliciesTabProps) => {
  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-none bg-muted/50 rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-foreground/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-right text-lg text-foreground">سياسة الإرجاع والاستبدال</CardTitle>
              <CardDescription className="text-right text-muted-foreground">
                حدد سياسة الإرجاع والاستبدال لمتجرك
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={settings.returnPolicy}
            onChange={(e) => setSettings((prev: any) => ({ ...prev, returnPolicy: e.target.value }))}
            className="min-h-[120px] rounded-xl text-right text-foreground bg-background"
            placeholder="مثال: يمكن إرجاع المنتج خلال 7 أيام من تاريخ الاستلام بشرط أن يكون بحالته الأصلية..."
            dir="rtl"
          />
        </CardContent>
      </Card>

      <Card className="border-0 shadow-none bg-muted/50 rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-foreground/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-right text-lg text-foreground">الشروط والأحكام</CardTitle>
              <CardDescription className="text-right text-muted-foreground">
                شروط وأحكام استخدام متجرك
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={settings.termsConditions}
            onChange={(e) => setSettings((prev: any) => ({ ...prev, termsConditions: e.target.value }))}
            className="min-h-[120px] rounded-xl text-right text-foreground bg-background"
            placeholder="مثال: باستخدامك لهذا المتجر فأنت توافق على الشروط والأحكام التالية..."
            dir="rtl"
          />
        </CardContent>
      </Card>

      <Card className="border-0 shadow-none bg-muted/50 rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-foreground/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-right text-lg text-foreground">سياسة الخصوصية</CardTitle>
              <CardDescription className="text-right text-muted-foreground">
                كيف تتعامل مع بيانات العملاء
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={settings.privacyPolicy}
            onChange={(e) => setSettings((prev: any) => ({ ...prev, privacyPolicy: e.target.value }))}
            className="min-h-[120px] rounded-xl text-right text-foreground bg-background"
            placeholder="مثال: نحن نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية..."
            dir="rtl"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default PoliciesTab;
