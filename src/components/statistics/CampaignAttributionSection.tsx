
import { Megaphone } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export interface CampaignAttributionRow {
  source: string;
  medium: string;
  campaign: string;
  orders: number;
  revenue: number;
}

interface CampaignAttributionSectionProps {
  campaigns: CampaignAttributionRow[];
}

export const CampaignAttributionSection = ({ campaigns }: CampaignAttributionSectionProps) => {
  return (
    <div className="animate-fade-in mb-8">
      <Card className="border border-border shadow-sm rounded-2xl bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-right text-foreground text-base flex items-center gap-2 justify-end">
            <span>أداء الحملات التسويقية</span>
            <Megaphone className="w-5 h-5 text-primary" />
          </CardTitle>
          <CardDescription className="text-right">
            الطلبات والإيرادات حسب مصدر UTM المرفق عند الشراء
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm leading-relaxed">
              لا توجد طلبات مرتبطة بحملات UTM في هذه الفترة.
              <br />
              شارك روابط متجرك مع معاملات utm_source و utm_campaign لتتبع الأداء.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-right py-2 font-medium">المصدر</th>
                    <th className="text-right py-2 font-medium">الوسيط</th>
                    <th className="text-right py-2 font-medium">الحملة</th>
                    <th className="text-right py-2 font-medium">الطلبات</th>
                    <th className="text-right py-2 font-medium">الإيرادات</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((row) => (
                    <tr key={`${row.source}-${row.medium}-${row.campaign}`} className="border-b border-border/30 last:border-0">
                      <td className="py-2.5 text-right text-foreground">{row.source}</td>
                      <td className="py-2.5 text-right text-muted-foreground">{row.medium}</td>
                      <td className="py-2.5 text-right text-muted-foreground">{row.campaign}</td>
                      <td className="py-2.5 text-right font-medium">{row.orders}</td>
                      <td className="py-2.5 text-right font-medium text-green-600">
                        {Math.round(row.revenue).toLocaleString()} د.ع
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
