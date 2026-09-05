/**
 * Sync server-side DB/queue gauges from platform_monitoring_observability_audit RPC.
 * Best-effort — requires service_role (ops scripts) or returns silently for merchant sessions.
 */
import { callReadRpc } from '@/lib/readWrite/readClient';
import {
  recordAnalyticsQueue,
  recordServerDatabaseMetrics,
  recordSecurityEvent,
  recordSideEffectsQueue,
} from './instrumentation';

export type ServerMonitoringAudit = {
  database?: {
    size_bytes?: number;
    lock_waits?: number;
    connection_saturation?: {
      saturation_pct?: number;
      waiting?: number;
      active?: number;
    };
    internals?: {
      cpu_utilization_pct?: number;
    };
  };
  analytics_queue?: {
    pending?: number;
    oldest_pending_seconds?: number;
  };
  webhook_queue?: {
    failed_dead_letter?: number;
  };
};

export type SideEffectsBacklogHealth = {
  pending?: number;
  oldest_minutes?: number;
  errors?: number;
  dead_letter?: number;
  processed_last_60s?: number;
  last_worker_success_at?: string | null;
  worker_stale_minutes?: number | null;
  healthy?: boolean;
  warning?: boolean;
  critical?: boolean;
};

export async function probeServerMonitoringMetrics(): Promise<ServerMonitoringAudit | null> {
  const { data, error } = await callReadRpc<ServerMonitoringAudit>(
    'platform_monitoring_observability_audit'
  );
  if (error || !data) return null;
  return data;
}

export async function probeSideEffectsBacklogHealth(): Promise<SideEffectsBacklogHealth | null> {
  const { data, error } = await callReadRpc<SideEffectsBacklogHealth>(
    'side_effects_outbox_backlog_health'
  );
  if (error || !data) return null;
  return data;
}

export async function syncServerMonitoringMetrics(): Promise<boolean> {
  const audit = await probeServerMonitoringMetrics();
  const sideEffects = await probeSideEffectsBacklogHealth();
  if (!audit && !sideEffects) return false;

  if (audit) {
    const saturation = audit.database?.connection_saturation;
    recordServerDatabaseMetrics({
      connectionSaturationPct: saturation?.saturation_pct,
      connectionWait: saturation?.waiting,
      lockWaits: audit.database?.lock_waits,
      dbSizeBytes: audit.database?.size_bytes,
      cpuUtilizationPct: audit.database?.internals?.cpu_utilization_pct,
    });

    const analytics = audit.analytics_queue;
    if (analytics) {
      recordAnalyticsQueue({
        queue: 'server_analytics_outbox',
        depth: Number(analytics.pending ?? 0),
        backlogAgeMs: Number(analytics.oldest_pending_seconds ?? 0) * 1000,
      });
    }

    const webhookFailed = Number(audit.webhook_queue?.failed_dead_letter ?? 0);
    if (webhookFailed > 0) {
      recordSecurityEvent('webhook_failure', 'order_webhook_outbox');
    }
  }

  if (sideEffects) {
    recordSideEffectsQueue({
      pending: Number(sideEffects.pending ?? 0),
      workerStaleMinutes: sideEffects.worker_stale_minutes ?? null,
      deadLetter: Number(sideEffects.dead_letter ?? 0),
      processedLast60s: Number(sideEffects.processed_last_60s ?? 0),
    });
  }

  return true;
}

let probeTimer: ReturnType<typeof setInterval> | null = null;

/** Poll server metrics every 60s when running in browser (admin/ops sessions). */
export function startServerMetricsProbe(intervalMs = 60_000): void {
  if (typeof window === 'undefined' || intervalMs <= 0) return;
  if (probeTimer) clearInterval(probeTimer);
  void syncServerMonitoringMetrics();
  probeTimer = setInterval(() => {
    void syncServerMonitoringMetrics();
  }, intervalMs);
}

export function stopServerMetricsProbe(): void {
  if (probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
}
