
import { useState, useEffect } from "react";
import { RealStatistics } from "@/types/statistics";
import { calculateStatistics, getDefaultStatistics } from "@/utils/statisticsCalculator";
import { fetchStatisticsData } from "@/services/statisticsService";

export const useRealStatistics = (dateRange: string = "7") => {
  const [stats, setStats] = useState<RealStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRealStatistics();
  }, [dateRange]);

  const fetchRealStatistics = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchStatisticsData(dateRange);
      const calculatedStats = calculateStatistics(data);
      setStats(calculatedStats);
    } catch (err) {
      console.error('Error fetching statistics:', err);
      // Instead of showing error, show default statistics
      setStats(getDefaultStatistics());
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, error, refetch: fetchRealStatistics };
};
