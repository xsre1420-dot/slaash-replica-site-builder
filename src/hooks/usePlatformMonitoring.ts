import { useCallback, useEffect, useState } from 'react';
import {
  fetchPlatformMonitoringSnapshot,
  type PlatformMonitoringSnapshot,
} from '@/services/platformMonitoringService';
import { useVisibilityAwareInterval } from '@/hooks/useVisibilityAwareInterval';
import { useIsMounted } from '@/hooks/useIsMounted';

const REFRESH_MS = 30_000;

export const usePlatformMonitoring = (enabled = true) => {
  const [snapshot, setSnapshot] = useState<PlatformMonitoringSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useIsMounted();

  const refresh = useCallback(async (forceDb = true) => {
    if (!enabled) return null;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlatformMonitoringSnapshot(forceDb);
      if (mountedRef.current) setSnapshot(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'فشل تحميل حالة المنصة';
      if (mountedRef.current) setError(message);
      return null;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled, mountedRef]);

  useEffect(() => {
    if (!enabled) {
      setSnapshot(null);
      return;
    }
    void refresh(false);
  }, [enabled, refresh]);

  useVisibilityAwareInterval(() => {
    void refresh(false);
  }, REFRESH_MS, enabled);

  return { snapshot, loading, error, refresh };
};
