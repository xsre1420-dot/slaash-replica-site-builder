import { useState, useEffect, useCallback, useRef } from 'react';
import { env } from '@/lib/env';
import {
  DR_STORAGE_KEYS,
  DR_THRESHOLDS,
  RecoveryMode,
  checkEndpointHealth,
  activateFailover,
  isFailoverActive,
  resolveSupabaseConfig,
} from '@/lib/disasterRecovery';
import { logger, metrics } from '@/lib/observability';

export const useRecoveryMonitor = () => {
  const [mode, setMode] = useState<RecoveryMode>(() =>
    isFailoverActive() ? 'failover' : 'normal'
  );
  const failuresRef = useRef(0);
  const checkingRef = useRef(false);

  const runHealthCheck = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;

    try {
      const cfg = resolveSupabaseConfig();
      const healthy = await checkEndpointHealth(cfg.url);

      try {
        sessionStorage.setItem(DR_STORAGE_KEYS.LAST_HEALTH_CHECK, new Date().toISOString());
      } catch {
        /* ignore */
      }

      if (healthy) {
        failuresRef.current = 0;
        try {
          sessionStorage.setItem(DR_STORAGE_KEYS.CONSECUTIVE_FAILURES, '0');
        } catch {
          /* ignore */
        }
        setMode(isFailoverActive() ? 'failover' : 'normal');
        metrics.increment('dr.health.ok', { endpoint: cfg.label });
        return;
      }

      failuresRef.current += 1;
      try {
        sessionStorage.setItem(DR_STORAGE_KEYS.CONSECUTIVE_FAILURES, String(failuresRef.current));
      } catch {
        /* ignore */
      }

      metrics.increment('dr.health.failed', { endpoint: cfg.label });
      logger.warn('dr.health.failed', {
        endpoint: cfg.label,
        failures: failuresRef.current,
      });

      if (
        failuresRef.current >= DR_THRESHOLDS.FAILURES_BEFORE_FAILOVER &&
        env.VITE_FAILOVER_SUPABASE_URL &&
        !isFailoverActive()
      ) {
        const activated = activateFailover();
        if (activated) {
          logger.error('dr.failover.activated', { failures: failuresRef.current });
          metrics.increment('dr.failover.activated');
          window.location.reload();
          return;
        }
      }

      setMode('degraded');
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    runHealthCheck();
    const id = setInterval(runHealthCheck, DR_THRESHOLDS.HEALTH_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [runHealthCheck]);

  return { mode, runHealthCheck };
};
