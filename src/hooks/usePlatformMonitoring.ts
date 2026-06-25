import { useCallback, useEffect, useState } from 'react';
import {
  fetchPlatformMonitoringSnapshot,
  type PlatformMonitoringSnapshot,
} from '@/services/platformMonitoringService';

const REFRESH_MS = 30_000;

export const usePlatformMonitoring = (enabled = true) => {
  const [snapshot, setSnapshot] = useState<PlatformMonitoringSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (forceDb = true) => {
    if (!enabled) return null;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlatformMonitoringSnapshot(forceDb);
      setSnapshot(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'فشل تحميل حالة المنصة';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setSnapshot(null);
      return;
    }
    void refresh(false);
    const id = setInterval(() => void refresh(false), REFRESH_MS);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  return { snapshot, loading, error, refresh };
};
