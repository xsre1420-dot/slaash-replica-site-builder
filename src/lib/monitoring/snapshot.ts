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
    cacheHitRate: number;
    slowQueryCount: number;
    queueBacklog: number;
    deadLetterCount: number;
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

export function getPlatformMetricsSnapshot(): PlatformMetricsSnapshot {
  const cache = getCacheMonitoringSnapshot();
  const checkoutSuccess = sumCounter(METRIC_NAMES.checkout.successTotal);
  const checkoutFailed = sumCounter(METRIC_NAMES.checkout.failedTotal);
  const checkoutTotal = checkoutSuccess + checkoutFailed;
  const rpcCalls = sumCounter(METRIC_NAMES.rpc.callsTotal);
  const rpcErrors = sumCounter(METRIC_NAMES.rpc.errorsTotal);

  const queueDepth = getGaugeSnapshot()
    .filter((g) => g.name === METRIC_NAMES.worker.queueDepth)
    .reduce((a, g) => a + g.value, 0);

  const deadLetter = sumCounter(METRIC_NAMES.worker.deadLetterTotal);

  return {
    generatedAt: new Date().toISOString(),
    counters: getCounterSnapshot(),
    gauges: getGaugeSnapshot(),
    histograms: getHistogramSnapshot(),
    derived: {
      checkoutSuccessRate: checkoutTotal > 0 ? checkoutSuccess / checkoutTotal : 1,
      rpcErrorRate: rpcCalls > 0 ? rpcErrors / rpcCalls : 0,
      cacheHitRate: cache.aggregate.hitRate,
      slowQueryCount: sumCounter(METRIC_NAMES.database.slowQueriesTotal),
      queueBacklog: queueDepth,
      deadLetterCount: deadLetter,
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
    const bg = await fetchBackgroundMonitoringSnapshot();
    bgSnapshot = {
      pendingJobCount: bg.pendingJobCount,
      deadLetterCount: bg.deadLetterCount,
    };
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
