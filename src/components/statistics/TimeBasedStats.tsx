
import { Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface TimeBasedStatsProps {
  peakTimes: Array<{
    time: string;
    orders: number;
    percentage: number;
  }>;
}

export const TimeBasedStats = ({ peakTimes }: TimeBasedStatsProps) => {
  const topPeakTime = peakTimes.length > 0 ? [peakTimes[0]] : [];

  return (
    <div className="mb-8 animate-fade-in" style={{ animationDelay: '200ms' }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
          <Clock className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">أوقات الذروة</h2>
      </div>
      
      <Card className="border border-border shadow-sm rounded-2xl bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-right text-foreground text-base">وقت الذروة الأكثر نشاطاً</CardTitle>
          <CardDescription className="text-right">
            {topPeakTime.length === 0 ? "لا توجد بيانات أوقات ذروة متاحة حالياً" : "الوقت الأكثر نشاطاً في الطلبات"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topPeakTime.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              لا توجد أوقات ذروة لعرضها
            </div>
          ) : (
            <div className="space-y-3">
              {topPeakTime.map((time) => (
                <div key={time.time} className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="text-base text-muted-foreground font-medium">{time.orders} طلب</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary text-primary-foreground">
                      {time.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-right">
                    <h4 className="text-lg font-bold text-foreground">{time.time}</h4>
                    <span className="text-xs text-primary font-medium">أكثر الأوقات نشاطاً</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
