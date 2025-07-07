
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
  // Show only the top peak time if it exists
  const topPeakTime = peakTimes.length > 0 ? [peakTimes[0]] : [];

  if (topPeakTime.length === 0) {
    return (
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#6D63F2' }}>
            <Clock className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">🕒 أوقات الذروة</h2>
        </div>
        
        <Card className="border-0 shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="text-right">وقت الذروة الأكثر نشاطاً</CardTitle>
            <CardDescription className="text-right">لا توجد بيانات أوقات ذروة متاحة حالياً</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              لا توجد أوقات ذروة لعرضها
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#6D63F2' }}>
          <Clock className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">🕒 أوقات الذروة</h2>
      </div>
      
      <Card className="border-0 shadow-sm rounded-3xl">
        <CardHeader>
          <CardTitle className="text-right">وقت الذروة الأكثر نشاطاً</CardTitle>
          <CardDescription className="text-right">الوقت الأكثر نشاطاً في الطلبات</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topPeakTime.map((time) => (
              <div key={time.time} className="flex items-center justify-between p-6 rounded-2xl" style={{ background: 'linear-gradient(to right, rgba(109, 99, 242, 0.1), rgba(109, 99, 242, 0.05))' }}>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-gray-600 font-medium">{time.orders} طلب</span>
                    <span className="text-sm px-3 py-1 rounded-full font-medium" style={{ backgroundColor: '#6D63F2', color: 'white' }}>
                      {time.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <h4 className="text-xl font-bold text-gray-800">{time.time}</h4>
                  <span className="text-sm font-medium" style={{ color: '#6D63F2' }}>أكثر الأوقات نشاطاً</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
