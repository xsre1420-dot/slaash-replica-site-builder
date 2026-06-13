
import { useState, useEffect, useCallback, useMemo } from "react";
import { RealStatistics } from "@/types/statistics";
import { calculateStatistics, getDefaultStatistics } from "@/utils/statisticsCalculator";
import { fetchStatisticsData, getStatisticsDateBounds } from "@/services/statisticsService";

export const useRealStatistics = (
  dateRange: string = "7",
  startDate?: string,
  endDate?: string
) => {
  const [stats, setStats] = useState<RealStatistics | null>(getDefaultStatistics());
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateBounds = useMemo(
    () => getStatisticsDateBounds(dateRange, startDate, endDate),
    [dateRange, startDate, endDate]
  );

  const fetchRealStatistics = useCallback(async () => {
    if (dateRange === 'custom' && (!startDate || !endDate)) {
      setError('يرجى اختيار تاريخ البداية والنهاية');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchStatisticsData(dateRange, startDate, endDate);
      const bounds = data.dateBounds || dateBounds;
      const calculatedStats = calculateStatistics(data, bounds);
      setStats(calculatedStats);
      setTruncated(Boolean(data.truncated));

      setRawOrders(
        data.orders.filter(o => {
          const d = new Date(o.created_at);
          return d >= bounds.start && d <= bounds.end;
        })
      );
    } catch (err) {
      console.error('Error fetching statistics:', err);
      setStats(getDefaultStatistics());
      setRawOrders([]);
      setTruncated(false);
      setError('تعذر تحميل الإحصائيات. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [dateRange, startDate, endDate, dateBounds]);

  useEffect(() => {
    fetchRealStatistics();
  }, [fetchRealStatistics]);

  return { stats, rawOrders, loading, error, refetch: fetchRealStatistics, dateBounds, truncated };
};
