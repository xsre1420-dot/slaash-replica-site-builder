
import { useState, useEffect, useCallback } from "react";
import { RealStatistics } from "@/types/statistics";
import { calculateStatistics, getDefaultStatistics } from "@/utils/statisticsCalculator";
import { fetchStatisticsData } from "@/services/statisticsService";

export const useRealStatistics = (dateRange: string = "7") => {
  const [stats, setStats] = useState<RealStatistics | null>(getDefaultStatistics());
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRealStatistics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchStatisticsData(dateRange);
      const calculatedStats = calculateStatistics(data, dateRange);
      setStats(calculatedStats);
      // Store raw orders for the chart
      const days = parseInt(dateRange);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      setRawOrders(data.orders.filter(o => new Date(o.created_at) >= cutoff));
    } catch (err) {
      console.error('Error fetching statistics:', err);
      setStats(getDefaultStatistics());
      setRawOrders([]);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchRealStatistics();
  }, [fetchRealStatistics]);

  return { stats, rawOrders, loading, error, refetch: fetchRealStatistics };
};
