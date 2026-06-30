/**
 * Phase 5 — Subsystem health indicators.
 */
import type { PlatformMetricsSnapshot } from '@/lib/monitoring/snapshot';

export type HealthIndicatorStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';

export type HealthIndicator = {
  subsystem: string;
  status: HealthIndicatorStatus;
  score: number;
  signals: string[];
  lastCheckedAt: string;
};

const statusScore = (status: HealthIndicatorStatus): number => {
  switch (status) {
    case 'healthy':
      return 100;
    case 'degraded':
      return 70;
    case 'critical':
      return 30;
    default:
      return 50;
  }
};

function domainStatus(
  snapshot: PlatformMetricsSnapshot,
  domain: string
): HealthIndicatorStatus {
  const d = snapshot.health.find((h) => h.domain === domain);
  if (!d) return 'unknown';
  return d.status;
}

function poolStatus(snapshot: PlatformMetricsSnapshot): HealthIndicatorStatus {
  const util =
    snapshot.gauges.find((g) => g.name === 'db_connection_pool_utilization')?.value ?? 0;
  if (util >= 95) return 'critical';
  if (util >= 80) return 'degraded';
  return 'healthy';
}

function edgeStatus(snapshot: PlatformMetricsSnapshot): HealthIndicatorStatus {
  const errors = snapshot.counters
    .filter((c) => c.name === 'edge_errors_total')
    .reduce((a, c) => a + c.value, 0);
  const invocations = snapshot.counters
    .filter((c) => c.name === 'edge_invocations_total')
    .reduce((a, c) => a + c.value, 0);
  if (invocations === 0) return 'unknown';
  const rate = errors / invocations;
  if (rate > 0.05) return 'critical';
  if (rate > 0.02) return 'degraded';
  return 'healthy';
}

function cacheStatus(snapshot: PlatformMetricsSnapshot): HealthIndicatorStatus {
  const hitRate = snapshot.derived.cacheHitRate;
  const failures = snapshot.counters
    .filter((c) => c.name === 'cache_failures_total')
    .reduce((a, c) => a + c.value, 0);
  if (failures > 50) return 'critical';
  if (hitRate < 0.5 || failures > 10) return 'degraded';
  return 'healthy';
}

function queueStatus(snapshot: PlatformMetricsSnapshot): HealthIndicatorStatus {
  const depth = snapshot.derived.queueBacklog;
  const deadLetter = snapshot.derived.deadLetterCount;
  if (deadLetter > 10) return 'critical';
  if (depth > 100) return 'degraded';
  return 'healthy';
}

function searchStatus(snapshot: PlatformMetricsSnapshot): HealthIndicatorStatus {
  const p95 = snapshot.histograms.find((h) => h.name === 'search_duration_ms')?.p95 ?? 0;
  if (p95 > 4000) return 'critical';
  if (p95 > 2500) return 'degraded';
  return p95 > 0 ? 'healthy' : 'unknown';
}

function applicationStatus(snapshot: PlatformMetricsSnapshot): HealthIndicatorStatus {
  if (snapshot.derived.rpcErrorRate > 0.1) return 'critical';
  if (snapshot.derived.rpcErrorRate > 0.05) return 'degraded';
  return 'healthy';
}

export function computeHealthIndicators(snapshot: PlatformMetricsSnapshot): HealthIndicator[] {
  const now = snapshot.generatedAt;

  const indicators: Array<Omit<HealthIndicator, 'score'> & { status: HealthIndicatorStatus }> = [
    {
      subsystem: 'application',
      status: applicationStatus(snapshot),
      signals: [`rpc_error_rate=${snapshot.derived.rpcErrorRate.toFixed(4)}`],
      lastCheckedAt: now,
    },
    {
      subsystem: 'database',
      status: poolStatus(snapshot),
      signals: [
        `pool_util=${snapshot.gauges.find((g) => g.name === 'db_connection_pool_utilization')?.value ?? 0}`,
        `slow_queries=${snapshot.derived.slowQueryCount}`,
      ],
      lastCheckedAt: now,
    },
    {
      subsystem: 'rpc_layer',
      status: domainStatus(snapshot, 'database'),
      signals: [`rpc_p95=${snapshot.histograms.find((h) => h.name === 'rpc_duration_ms')?.p95 ?? 0}ms`],
      lastCheckedAt: now,
    },
    {
      subsystem: 'edge_functions',
      status: edgeStatus(snapshot),
      signals: ['edge_invocations/errors from counters'],
      lastCheckedAt: now,
    },
    {
      subsystem: 'queue_workers',
      status: queueStatus(snapshot),
      signals: [
        `queue_depth=${snapshot.derived.queueBacklog}`,
        `dead_letter=${snapshot.derived.deadLetterCount}`,
      ],
      lastCheckedAt: now,
    },
    {
      subsystem: 'cache_layer',
      status: cacheStatus(snapshot),
      signals: [`hit_rate=${snapshot.derived.cacheHitRate.toFixed(2)}`],
      lastCheckedAt: now,
    },
    {
      subsystem: 'realtime',
      status: domainStatus(snapshot, 'realtime'),
      signals: ['domain health from healthMonitor'],
      lastCheckedAt: now,
    },
    {
      subsystem: 'storage',
      status:
        snapshot.counters
          .filter((c) => c.name === 'errors_by_category_total' && c.labels.category === 'storage')
          .reduce((a, c) => a + c.value, 0) > 5
          ? 'degraded'
          : 'healthy',
      signals: ['storage error counter'],
      lastCheckedAt: now,
    },
    {
      subsystem: 'search',
      status: searchStatus(snapshot),
      signals: [`search_p95=${snapshot.histograms.find((h) => h.name === 'search_duration_ms')?.p95 ?? 0}ms`],
      lastCheckedAt: now,
    },
    {
      subsystem: 'background_processing',
      status: queueStatus(snapshot),
      signals: [`job_throughput from business metrics`],
      lastCheckedAt: now,
    },
  ];

  return indicators.map((i) => ({
    ...i,
    score: statusScore(i.status),
  }));
}

export function computeSystemHealthScore(indicators: HealthIndicator[]): number {
  if (indicators.length === 0) return 0;
  const avg = indicators.reduce((a, i) => a + i.score, 0) / indicators.length;
  return Math.round(avg * 10) / 10;
}
