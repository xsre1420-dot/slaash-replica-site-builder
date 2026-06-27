import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchPlatformHealth,
  invalidatePlatformHealthCache,
  type PlatformHealthResult,
} from '@/services/platformHealthService';

export const usePlatformDbHealth = (enabled = true) => {
  const { user } = useAuth();
  const [health, setHealth] = useState<PlatformHealthResult | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setHealth(null);
      return null;
    }
    setLoading(true);
    try {
      invalidatePlatformHealthCache();
      const result = await fetchPlatformHealth(true);
      setHealth(result);
      return result;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!enabled || !user?.id) {
      setHealth(null);
      return;
    }
    let cancelled = false;
    void fetchPlatformHealth().then((result) => {
      if (!cancelled) setHealth(result);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, user?.id]);

  return { health, loading, refresh, needsAttention: health != null && !health.ok };
};
