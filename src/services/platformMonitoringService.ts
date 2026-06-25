import { getAllDomainHealth, type DomainHealthStats } from '@/lib/observability/healthMonitor';
import { getMerchantRealtimeHubStatus } from '@/lib/merchantRealtimeHub';
import { checkEndpointHealth, isFailoverActive, resolveSupabaseConfig } from '@/lib/disasterRecovery/failover';
import { DR_STORAGE_KEYS } from '@/lib/disasterRecovery/config';
import {
  fetchPlatformHealth,
  type PlatformHealthResult,
} from '@/services/platformHealthService';

export type SubsystemStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';

export type PlatformMonitoringSnapshot = {
  timestamp: string;
  overall: SubsystemStatus;
  system: {
    status: SubsystemStatus;
    appHealth: boolean;
    failoverActive: boolean;
    endpointLabel: string;
    endpointReachable: boolean | null;
    consecutiveFailures: number;
  };
  database: PlatformHealthResult & { status: SubsystemStatus };
  storage: { status: SubsystemStatus; available: boolean };
  authentication: { status: SubsystemStatus; loginFailures: number; registerFailures: number };
  realtime: {
    status: SubsystemStatus;
    activeProductChannels: number;
    activeOrderChannels: number;
    pendingReconnects: number;
    maxAttemptsExceeded: number;
    recentFailures: number;
  };
  api: { status: SubsystemStatus; recentFailures: number; slowQueries: number };
  errorDomains: DomainHealthStats[];
};

const toSubsystem = (ok: boolean, degraded = false): SubsystemStatus => {
  if (ok) return 'healthy';
  if (degraded) return 'degraded';
  return 'critical';
};

const readConsecutiveFailures = (): number => {
  try {
    return Number(sessionStorage.getItem(DR_STORAGE_KEYS.CONSECUTIVE_FAILURES) ?? '0') || 0;
  } catch {
    return 0;
  }
};

export async function fetchPlatformMonitoringSnapshot(
  forceDbCheck = false
): Promise<PlatformMonitoringSnapshot> {
  const timestamp = new Date().toISOString();
  const errorDomains = getAllDomainHealth();

  let appHealth = false;
  try {
    const res = await fetch('/health.json', { cache: 'no-store' });
    appHealth = res.ok;
  } catch {
    appHealth = false;
  }

  const dbHealth = await fetchPlatformHealth(forceDbCheck);
  const dbStatus: SubsystemStatus = dbHealth.ok
    ? 'healthy'
    : dbHealth.message === 'connection_error'
      ? 'critical'
      : 'degraded';

  const storageOk = Boolean(dbHealth.checks.storage);
  const loginStats = errorDomains.find((d) => d.domain === 'auth.login');
  const registerStats = errorDomains.find((d) => d.domain === 'auth.register');
  const authStatus: SubsystemStatus =
    (loginStats?.failures ?? 0) >= 10 || (registerStats?.failures ?? 0) >= 5
      ? 'degraded'
      : 'healthy';

  const realtimeHub = getMerchantRealtimeHubStatus();
  const realtimeStats = errorDomains.find((d) => d.domain === 'realtime');
  const realtimeStatus: SubsystemStatus =
    realtimeHub.maxAttemptsExceeded > 0 || (realtimeStats?.failures ?? 0) >= 3
      ? 'degraded'
      : 'healthy';

  const apiStats = errorDomains.find((d) => d.domain === 'api');
  const dbStats = errorDomains.find((d) => d.domain === 'database');
  const apiStatus: SubsystemStatus =
    (dbStats?.failures ?? 0) >= 3 ? 'critical' : (apiStats?.failures ?? 0) >= 2 ? 'degraded' : 'healthy';

  const cfg = resolveSupabaseConfig();
  let endpointReachable: boolean | null = null;
  try {
    endpointReachable = await checkEndpointHealth(cfg.url);
  } catch {
    endpointReachable = false;
  }

  const consecutiveFailures = readConsecutiveFailures();
  const systemStatus: SubsystemStatus =
    !appHealth || consecutiveFailures >= 3
      ? 'critical'
      : endpointReachable === false
        ? 'degraded'
        : 'healthy';

  const statuses: SubsystemStatus[] = [
    systemStatus,
    dbStatus,
    storageOk ? 'healthy' : 'degraded',
    authStatus,
    realtimeStatus,
    apiStatus,
  ];

  const overall: SubsystemStatus = statuses.includes('critical')
    ? 'critical'
    : statuses.includes('degraded')
      ? 'degraded'
      : 'healthy';

  return {
    timestamp,
    overall,
    system: {
      status: systemStatus,
      appHealth,
      failoverActive: isFailoverActive(),
      endpointLabel: cfg.label,
      endpointReachable,
      consecutiveFailures,
    },
    database: { ...dbHealth, status: dbStatus },
    storage: { status: toSubsystem(storageOk, !storageOk), available: storageOk },
    authentication: {
      status: authStatus,
      loginFailures: loginStats?.failures ?? 0,
      registerFailures: registerStats?.failures ?? 0,
    },
    realtime: {
      status: realtimeStatus,
      ...realtimeHub,
      recentFailures: realtimeStats?.failures ?? 0,
    },
    api: {
      status: apiStatus,
      recentFailures: (apiStats?.failures ?? 0) + (dbStats?.failures ?? 0),
      slowQueries: dbStats?.slowCount ?? 0,
    },
    errorDomains,
  };
}
