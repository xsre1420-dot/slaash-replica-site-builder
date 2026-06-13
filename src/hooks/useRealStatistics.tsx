
import { useState, useEffect, useCallback } from "react";
import { RealStatistics } from "@/types/statistics";
import { calculateStatistics, getDefaultStatistics } from "@/utils/statisticsCalculator";
import { fetchStatisticsData } from "@/services/statisticsService";

export const useRealStatistics = (
  dateRange: string = "7",
  startDate?: string,
  endDate?: string
) => {
  const [stats, setStats] = useState<RealStatistics | null>(getDefaultStatistics());
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRealStatistics = useCallback(async () => {
    if (dateRange === 'custom' && (!startDate || !endDate)) {
      setError('يرجى اختيار تاريخ البداية والنهاية');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchStatisticsData(dateRange, startDate, endDate);
      const calculatedStats = calculateStatistics(data, dateRange === 'custom' ? String(
        Math.max(1, Math.ceil((new Date(endDate!).getTime() - new Date(startDate!).getTime()) / 86400000))
      ) : dateRange);
      setStats(calculatedStats);

      let cutoff: Date;
      if (dateRange === 'custom' && startDate) {
        cutoff = new Date(startDate);
        cutoff.setHours(0, 0, 0, 0);
      } else {
        const days = parseInt(dateRange) || 7;
        cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      }
      setRawOrders(data.orders.filter(o => new Date(o.created_at) >= cutoff));
    } catch (err) {
      console.error('Error fetching statistics:', err);
      setStats(getDefaultStatistics());
      setRawOrders([]);
      setError('تعذر تحميل الإحصائيات. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [dateRange, startDate, endDate]);

  useEffect(() => {
    fetchRealStatistics();
  }, [fetchRealStatistics]);

  return { stats, rawOrders, loading, error, refetch: fetchRealStatistics };
};
