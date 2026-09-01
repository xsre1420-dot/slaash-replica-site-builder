import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { RealStatistics } from "@/types/statistics";
import { calculateStatistics, getDefaultStatistics } from "@/utils/statisticsCalculator";
import {
  getStatisticsDateBounds,
  loadStatisticsPageBundle,
  peekStatisticsPageBundle,
} from "@/services/statisticsService";

export const useRealStatistics = (
  dateRange: string = "7",
  startDate?: string,
  endDate?: string
) => {
  const { user } = useAuth();
  const ownerId = user?.id;

  const dateBounds = useMemo(
    () => getStatisticsDateBounds(dateRange, startDate, endDate),
    [dateRange, startDate, endDate]
  );

  const [stats, setStats] = useState<RealStatistics | null>(() => {
    if (!ownerId) return null;
    const cached = peekStatisticsPageBundle(ownerId, dateRange, startDate, endDate);
    return cached ? calculateStatistics(cached, cached.dateBounds || dateBounds) : null;
  });
  const [rawOrders, setRawOrders] = useState<any[]>(() => {
    if (!ownerId) return [];
    const cached = peekStatisticsPageBundle(ownerId, dateRange, startDate, endDate);
    if (!cached?.orders) return [];
    const bounds = cached.dateBounds || dateBounds;
    return cached.orders.filter((o) => {
      const d = new Date(o.created_at);
      return d >= bounds.start && d <= bounds.end;
    });
  });
  const [truncated, setTruncated] = useState(() => {
    if (!ownerId) return false;
    return Boolean(peekStatisticsPageBundle(ownerId, dateRange, startDate, endDate)?.truncated);
  });
  const [fetchWarnings, setFetchWarnings] = useState<string[]>(() => {
    if (!ownerId) return [];
    return peekStatisticsPageBundle(ownerId, dateRange, startDate, endDate)?.fetchWarnings ?? [];
  });
  const [loading, setLoading] = useState(() => {
    if (!ownerId) return false;
    return !peekStatisticsPageBundle(ownerId, dateRange, startDate, endDate);
  });
  const [error, setError] = useState<string | null>(null);

  const applyStatisticsData = useCallback(
    (data: Awaited<ReturnType<typeof loadStatisticsPageBundle>>) => {
      const bounds = data.dateBounds || dateBounds;
      const calculatedStats = calculateStatistics(data, bounds);
      setStats(calculatedStats);
      setTruncated(Boolean(data.truncated));
      setFetchWarnings(data.fetchWarnings ?? []);
      setRawOrders(
        data.orders.filter((o) => {
          const d = new Date(o.created_at);
          return d >= bounds.start && d <= bounds.end;
        })
      );
      setError(null);
    },
    [dateBounds]
  );

  const fetchRealStatistics = useCallback(
    async (skipCache = false) => {
      if (dateRange === "custom" && (!startDate || !endDate)) {
        setError("يرجى اختيار تاريخ البداية والنهاية");
        return;
      }

      if (!skipCache && ownerId) {
        const cached = peekStatisticsPageBundle(ownerId, dateRange, startDate, endDate);
        if (cached) {
          applyStatisticsData(cached);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      setError(null);

      try {
        const data = await loadStatisticsPageBundle(dateRange, startDate, endDate, { skipCache });
        applyStatisticsData(data);
      } catch (err) {
        console.error("Error fetching statistics:", err);
        setStats(getDefaultStatistics());
        setRawOrders([]);
        setTruncated(false);
        setFetchWarnings([]);
        setError("تعذر تحميل الإحصائيات. يرجى المحاولة مرة أخرى.");
      } finally {
        setLoading(false);
      }
    },
    [dateRange, startDate, endDate, ownerId, applyStatisticsData]
  );

  useEffect(() => {
    if (!ownerId) {
      setStats(null);
      setRawOrders([]);
      setLoading(false);
      return;
    }
    void fetchRealStatistics();
  }, [ownerId, fetchRealStatistics]);

  const refetch = useCallback(() => fetchRealStatistics(true), [fetchRealStatistics]);

  return { stats, rawOrders, loading, error, refetch, dateBounds, truncated, fetchWarnings };
};
