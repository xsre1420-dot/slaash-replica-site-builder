/**
 * Aggregated platform metrics snapshot for dashboards and export.
 */
import { getCounterSnapshot, getGaugeSnapshot, getHistogramSnapshot } from './metricCollector';
import { METRIC_NAMES } from './metricRegistry';
import { getMetricsAuditSummary } from './metricsAudit';
import { getCacheMonitoringSnapshot } from '@/lib/cache/cacheMonitoring';
import { getAllDomainHealth } from '@/lib/observability/healthMonitor';
import { getAllCircuitBreakerStatuses } from '@/lib/resilience/circuitBreaker';
import { getReadRoutingSummary } from '@/lib/disasterRecovery/readRouting';

export type PlatformMetricsSnapshot = {
  generatedAt: string;
  counters: ReturnType<typeof getCounterSnapshot>;
  gauges: ReturnType<typeof getGaugeSnapshot>;
  histograms: ReturnType<typeof getHistogramSnapshot>;
  derived: {
    checkoutSuccessRate: number;
    rpcErrorRate: number;
    rpcTimeoutRate: number;
    httpTimeoutRate: number;
    cacheHitRate: number;
    slowQueryCount: number;
    queueBacklog: number;
    deadLetterCount: number;
    analyticsBacklog: number;
    analyticsBacklogAgeMs: number;
    sideEffectsBacklog: number;
    sideEffectsWorkerStaleMinutes: number;
    orderFailureRate: number;
    securityEventRate: number;
    topRpcByLatency: Array<{ rpc: string; p95: number; p99: number; count: number }>;
  };
  cache: ReturnType<typeof getCacheMonitoringSnapshot>;
  health: ReturnType<typeof getAllDomainHealth>;
  circuitBreakers: ReturnType<typeof getAllCircuitBreakerStatuses>;
  readRouting: ReturnType<typeof getReadRoutingSummary>;
  audit: ReturnType<typeof getMetricsAuditSummary>;
  infra: {
    memoryUtilizationPct: number | null;
    jsHeapUsedMb: number | null;
  };
};

function sumCounter(name: string, labelFilter?: Record<string, string>): number {
  return getCounterSnapshot()
    .filter((c) => c.name === name)
    .filter((c) => {
      if (!labelFilter) return true;
      return Object.entries(labelFilter).every(([k, v]) => c.labels[k] === v);
    })
    .reduce((a, c) => a + c.value, 0);
}

function readMemoryInfra(): PlatformMetricsSnapshot['infra'] {
  try {
    const perf = performance as Performance & {
      memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
    };
    if (perf.memory) {
      const pct = (perf.memory.usedJSHeapSize / perf.memory.jsHeapSizeLimit) * 100;
      return {
        memoryUtilizationPct: Math.round(pct * 10) / 10,
        jsHeapUsedMb: Math.round(perf.memory.usedJSHeapSize / 1024 / 1024),
      };
    }
  } catch {
    /* ignore */
  }
  return { memoryUtilizationPct: null, jsHeapUsedMb: null };
}

function syncClientQueueMetricsFromSnapshot(): void {
  try {
    void import('@/background/queues/JobQueue').then(({ getAllQueueMetrics }) => {
      getAllQueueMetrics();
    });
  } catch {
    /* optional */
  }
}

function topRpcLatency(): PlatformMetricsSnapshot['derived']['topRpcByLatency'] {
  const byRpc = new Map<string, { p95: number; p99: number; count: number }>();
  for (const h of getHistogramSnapshot()) {
    if (h.name !== METRIC_NAMES.rpc.durationMs) continue;
    const rpc = h.labels.rpc ?? 'unknown';
    const existing = byRpc.get(rpc);
    if (!existing || h.p95 > existing.p95) {
      byRpc.set(rpc, { p95: h.p95, p99: h.p99, count: h.count });
    }
  }
  return [...byRpc.entries()]
    .map(([rpc, stats]) => ({ rpc, ...stats }))
    .sort((a, b) => b.p95 - a.p95)
    .slice(0, 10);
}

export function getPlatformMetricsSnapshot(): PlatformMetricsSnapshot {
  syncClientQueueMetricsFromSnapshot();
  const cache = getCacheMonitoringSnapshot();
  const checkoutSuccess = sumCounter(METRIC_NAMES.checkout.successTotal);
  const checkoutFailed = sumCounter(METRIC_NAMES.checkout.failedTotal);
  const checkoutTotal = checkoutSuccess + checkoutFailed;
  const rpcCalls = sumCounter(METRIC_NAMES.rpc.callsTotal);
  const rpcErrors = sumCounter(METRIC_NAMES.rpc.errorsTotal);
  const rpcTimeouts = sumCounter(METRIC_NAMES.rpc.timeoutsTotal);
  const httpCalls = sumCounter(METRIC_NAMES.http.requestsTotal);
  const httpTimeouts = sumCounter(METRIC_NAMES.http.timeoutsTotal);
  const ordersCreated = sumCounter(METRIC_NAMES.orders.createdTotal);
  const ordersFailed = sumCounter(METRIC_NAMES.orders.failedTotal);
  const ordersTotal = ordersCreated + ordersFailed;
  const securityEvents =
    sumCounter(METRIC_NAMES.security.authFailuresTotal) +
    sumCounter(METRIC_NAMES.security.rateLimitViolationsTotal) +
    sumCounter(METRIC_NAMES.security.crossTenantAttemptsTotal) +
    sumCounter(METRIC_NAMES.security.webhookFailuresTotal);

  const queueDepth = getGaugeSnapshot()
    .filter((g) => g.name === METRIC_NAMES.worker.queueDepth)
    .reduce((a, g) => a + g.value, 0);

  const analyticsDepth = getGaugeSnapshot()
    .filter((g) => g.name === METRIC_NAMES.analytics.queueDepth)
    .reduce((a, g) => a + g.value, 0);

  const analyticsBacklogAge = getGaugeSnapshot()
    .filter((g) => g.name === METRIC_NAMES.analytics.backlogAgeMs)
    .reduce((a, g) => Math.max(a, g.value), 0);

  const deadLetter = sumCounter(METRIC_NAMES.worker.deadLetterTotal);

  const sideEffectsDepth = getGaugeSnapshot()
    .filter((g) => g.name === METRIC_NAMES.sideEffects.pending)
    .reduce((a, g) => a + g.value, 0);

  const sideEffectsWorkerStale = getGaugeSnapshot()
    .filter((g) => g.name === METRIC_NAMES.sideEffects.workerStaleMinutes)
    .reduce((a, g) => Math.max(a, g.value), 0);

  return {
    generatedAt: new Date().toISOString(),
    counters: getCounterSnapshot(),
    gauges: getGaugeSnapshot(),
    histograms: getHistogramSnapshot(),
    derived: {
      checkoutSuccessRate: checkoutTotal > 0 ? checkoutSuccess / checkoutTotal : 1,
      rpcErrorRate: rpcCalls > 0 ? rpcErrors / rpcCalls : 0,
      rpcTimeoutRate: rpcCalls > 0 ? rpcTimeouts / rpcCalls : 0,
      httpTimeoutRate: httpCalls > 0 ? httpTimeouts / httpCalls : 0,
      cacheHitRate: cache.aggregate.hitRate,
      slowQueryCount: sumCounter(METRIC_NAMES.database.slowQueriesTotal),
      queueBacklog: queueDepth,
      deadLetterCount: deadLetter,
      analyticsBacklog: analyticsDepth,
      analyticsBacklogAgeMs: analyticsBacklogAge,
      sideEffectsBacklog: sideEffectsDepth,
      sideEffectsWorkerStaleMinutes: sideEffectsWorkerStale,
      orderFailureRate: ordersTotal > 0 ? ordersFailed / ordersTotal : 0,
      securityEventRate: rpcCalls > 0 ? securityEvents / Math.max(rpcCalls, 1) : 0,
      topRpcByLatency: topRpcLatency(),
    },
    cache,
    health: getAllDomainHealth(),
    circuitBreakers: getAllCircuitBreakerStatuses(),
    readRouting: getReadRoutingSummary(),
    audit: getMetricsAuditSummary(),
    infra: readMemoryInfra(),
  };
}

export async function getPlatformMetricsSnapshotAsync(): Promise<PlatformMetricsSnapshot> {
  let bgSnapshot: { pendingJobCount?: number; deadLetterCount?: number } = {};
  try {
    const { fetchBackgroundMonitoringSnapshot } = await import('@/background/monitoring/healthEndpoint');
    const { syncServerMonitoringMetrics } = await import('./serverMetricsProbe');
    const bg = await fetchBackgroundMonitoringSnapshot();
    bgSnapshot = {
      pendingJobCount: bg.pendingJobCount,
      deadLetterCount: bg.deadLetterCount,
    };
    if (bg.server?.analytics) {
      const { recordAnalyticsQueue } = await import('./instrumentation');
      recordAnalyticsQueue({
        queue: 'server_analytics_outbox',
        depth: bg.server.analytics.pending,
        backlogAgeMs: bg.server.analytics.oldestPendingSeconds * 1000,
      });
    }
    if (bg.server?.orderSideEffects) {
      const { recordSideEffectsQueue } = await import('./instrumentation');
      recordSideEffectsQueue({
        pending: bg.server.orderSideEffects.pending,
      });
    }
    await syncServerMonitoringMetrics();
  } catch {
    /* optional — server may be offline in tests */
  }

  const base = getPlatformMetricsSnapshot();
  if (bgSnapshot.pendingJobCount != null) {
    base.derived.queueBacklog = bgSnapshot.pendingJobCount;
  }
  if (bgSnapshot.deadLetterCount != null) {
    base.derived.deadLetterCount = bgSnapshot.deadLetterCount;
  }
  return base;
}
