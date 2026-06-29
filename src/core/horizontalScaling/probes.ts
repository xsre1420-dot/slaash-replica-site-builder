/**
 * Phase 7 — Health, readiness, and liveness probes for load balancers.
 */
import {
  isBackgroundWorkersRunning,
  getClientBackgroundStatus,
  stopBackgroundWorkers,
} from '@/background/scheduler/JobScheduler';
import { getWorkerInstanceId } from '@/core/distributed/workerIdentity';
import { getScalingAuditSummary } from '@/core/horizontalScaling/auditRegistry';
import { getSessionReadinessReport } from '@/core/horizontalScaling/sessionReadiness';
import { getDeploymentReadiness } from '@/core/horizontalScaling/deploymentReadiness';
import { getCacheMonitoringSnapshot } from '@/lib/cache/cacheMonitoring';
import { getPlatformMetricsSnapshot } from '@/lib/monitoring/snapshot';
import { env } from '@/lib/env';

export type ProbeStatus = 'ok' | 'degraded' | 'fail';

export type LivenessProbe = {
  status: ProbeStatus;
  alive: boolean;
  timestamp: string;
  instanceId: string;
};

export type ReadinessProbe = {
  status: ProbeStatus;
  ready: boolean;
  timestamp: string;
  checks: {
    env: boolean;
    workers: boolean;
    scalingAudit: boolean;
    session: boolean;
  };
  instanceId: string;
  workerUptimeMs: number;
};

export type HealthProbe = LivenessProbe & {
  version: string;
  deployment: ReturnType<typeof getDeploymentReadiness>;
  scaling: ReturnType<typeof getScalingAuditSummary>;
  cache: ReturnType<typeof getCacheMonitoringSnapshot>['aggregate'];
  metrics: ReturnType<typeof getPlatformMetricsSnapshot>['derived'];
  background: ReturnType<typeof getClientBackgroundStatus> | null;
};

export function getLivenessProbe(): LivenessProbe {
  return {
    status: 'ok',
    alive: true,
    timestamp: new Date().toISOString(),
    instanceId: getWorkerInstanceId(),
  };
}

export function getReadinessProbe(): ReadinessProbe {
  const envOk = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY);
  const workersOk = typeof window === 'undefined' || isBackgroundWorkersRunning();
  const scalingOk = getScalingAuditSummary().notReady === 0;
  const sessionOk = true;
  const bg = typeof window !== 'undefined' ? getClientBackgroundStatus() : null;

  const ready = envOk && scalingOk && sessionOk;
  return {
    status: ready ? (workersOk ? 'ok' : 'degraded') : 'fail',
    ready,
    timestamp: new Date().toISOString(),
    checks: { env: envOk, workers: workersOk, scalingAudit: scalingOk, session: sessionOk },
    instanceId: getWorkerInstanceId(),
    workerUptimeMs: bg?.uptimeMs ?? 0,
  };
}

export async function getHealthProbe(): Promise<HealthProbe> {
  const liveness = getLivenessProbe();
  const session = await getSessionReadinessReport();

  return {
    ...liveness,
    version: '86',
    deployment: getDeploymentReadiness(),
    scaling: getScalingAuditSummary(),
    cache: getCacheMonitoringSnapshot().aggregate,
    metrics: getPlatformMetricsSnapshot().derived,
    background: typeof window !== 'undefined' ? getClientBackgroundStatus() : null,
  };
}

export type GracefulShutdownOptions = {
  timeoutMs?: number;
  onShutdown?: () => void;
};

let shuttingDown = false;

export function isGracefulShutdownInProgress(): boolean {
  return shuttingDown;
}

/** Graceful shutdown — stop workers, allow in-flight requests to complete. */
export async function gracefulShutdown(options: GracefulShutdownOptions = {}): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  stopBackgroundWorkers();
  options.onShutdown?.();

  await new Promise((r) => setTimeout(r, options.timeoutMs ?? 100));
  shuttingDown = false;
}

export type GracefulStartupOptions = {
  startWorkers?: () => void;
};

let started = false;

export function gracefulStartup(options: GracefulStartupOptions = {}): void {
  if (started) return;
  started = true;
  options.startWorkers?.();
}

/** Install page lifecycle hooks for graceful worker shutdown. */
export function installGracefulLifecycle(startWorkers: () => void): void {
  gracefulStartup({ startWorkers });

  if (typeof window === 'undefined') return;

  const shutdown = () => {
    void gracefulShutdown({ timeoutMs: 50 });
  };

  window.addEventListener('beforeunload', shutdown);
  window.addEventListener('pagehide', shutdown);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      /* keep workers running — only full unload stops them */
    }
  });
}

/** @internal test helper */
export function resetGracefulLifecycleForTests(): void {
  shuttingDown = false;
  started = false;
}
