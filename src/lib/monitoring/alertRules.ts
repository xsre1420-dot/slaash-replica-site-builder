/**
 * Vendor-neutral alert rule catalog — wire to PagerDuty, Grafana Alerting, Datadog, etc.
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertRule = {
  id: string;
  name: string;
  severity: AlertSeverity;
  metric: string;
  condition: 'gt' | 'gte' | 'lt' | 'lte' | 'rate_gt';
  threshold: number;
  windowSec: number;
  description: string;
  runbook: string;
};

export const ALERT_RULES: AlertRule[] = [
  {
    id: 'high-latency-rpc',
    name: 'High RPC Latency',
    severity: 'warning',
    metric: 'rpc_duration_ms',
    condition: 'gt',
    threshold: 2000,
    windowSec: 300,
    description: 'RPC P95 latency exceeds 2s for 5 minutes',
    runbook: 'Check read replica health, connection pool, slow queries',
  },
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    severity: 'critical',
    metric: 'rpc_errors_total',
    condition: 'rate_gt',
    threshold: 0.05,
    windowSec: 300,
    description: 'RPC error rate exceeds 5%',
    runbook: 'Inspect error taxonomy logs, circuit breaker state',
  },
  {
    id: 'slow-queries',
    name: 'Slow Query Spike',
    severity: 'warning',
    metric: 'db_slow_queries_total',
    condition: 'gt',
    threshold: 10,
    windowSec: 600,
    description: 'More than 10 slow queries in 10 minutes',
    runbook: 'Review EXPLAIN plans, index usage, lock waits',
  },
  {
    id: 'queue-backlog',
    name: 'Queue Backlog',
    severity: 'warning',
    metric: 'background_queue_depth',
    condition: 'gt',
    threshold: 100,
    windowSec: 300,
    description: 'Background queue depth exceeds 100',
    runbook: 'Scale workers, check dead letter queue, inspect job failures',
  },
  {
    id: 'worker-failures',
    name: 'Worker Dead Letter Spike',
    severity: 'critical',
    metric: 'background_dead_letter_total',
    condition: 'gt',
    threshold: 5,
    windowSec: 900,
    description: 'More than 5 jobs moved to dead letter in 15 minutes',
    runbook: 'Inspect background.job.dead_letter logs, retry policy',
  },
  {
    id: 'database-saturation',
    name: 'Database Pool Saturation',
    severity: 'critical',
    metric: 'db_connection_pool_utilization',
    condition: 'gte',
    threshold: 90,
    windowSec: 120,
    description: 'Connection pool utilization above 90%',
    runbook: 'Increase pool size, reduce connection hold time, check leaks',
  },
  {
    id: 'cache-failures',
    name: 'Cache Failure Rate',
    severity: 'warning',
    metric: 'cache_failures_total',
    condition: 'gt',
    threshold: 20,
    windowSec: 600,
    description: 'Cache fetch failures exceed threshold',
    runbook: 'Check KV/Redis, circuit breaker, fallback to origin',
  },
  {
    id: 'checkout-failure',
    name: 'Checkout Failure Rate',
    severity: 'critical',
    metric: 'checkout_failed_total',
    condition: 'rate_gt',
    threshold: 0.1,
    windowSec: 300,
    description: 'Checkout failure rate exceeds 10%',
    runbook: 'Inspect checkout.submit.failed logs, payment RPC, stock',
  },
  {
    id: 'infra-memory',
    name: 'High Memory Utilization',
    severity: 'warning',
    metric: 'infra_memory_utilization',
    condition: 'gte',
    threshold: 85,
    windowSec: 300,
    description: 'Client JS heap utilization above 85%',
    runbook: 'Review memory lifecycle hooks, cache bounds, tab count',
  },
  {
    id: 'infra-degradation',
    name: 'Infrastructure Degradation',
    severity: 'critical',
    metric: 'rpc_replica_fallback_total',
    condition: 'gt',
    threshold: 50,
    windowSec: 600,
    description: 'Excessive read replica fallbacks to primary',
    runbook: 'Check replica lag, network, platform_health_check',
  },
];

export type AlertEvaluation = {
  ruleId: string;
  name: string;
  severity: AlertSeverity;
  firing: boolean;
  currentValue: number;
  threshold: number;
  message: string;
};

export function evaluateAlertRules(snapshot: {
  derived: {
    rpcErrorRate: number;
    checkoutSuccessRate: number;
    slowQueryCount: number;
    queueBacklog: number;
    deadLetterCount: number;
    cacheHitRate: number;
  };
  gauges: Array<{ name: string; value: number; labels: Record<string, string> }>;
  histograms: Array<{ name: string; p95: number }>;
  infra: { memoryUtilizationPct: number | null };
}): AlertEvaluation[] {
  const gauge = (name: string) => snapshot.gauges.find((g) => g.name === name)?.value ?? 0;
  const histP95 = (name: string) => snapshot.histograms.find((h) => h.name === name)?.p95 ?? 0;
  const counterProxy = (name: string): number => {
    if (name === 'rpc_errors_total') return snapshot.derived.rpcErrorRate;
    if (name === 'checkout_failed_total') return 1 - snapshot.derived.checkoutSuccessRate;
    if (name === 'db_slow_queries_total') return snapshot.derived.slowQueryCount;
    if (name === 'background_queue_depth') return snapshot.derived.queueBacklog;
    if (name === 'background_dead_letter_total') return snapshot.derived.deadLetterCount;
    if (name === 'cache_failures_total') return gauge(name);
    if (name === 'rpc_replica_fallback_total') return gauge(name);
    if (name === 'db_connection_pool_utilization') return gauge(name);
    if (name === 'infra_memory_utilization') return snapshot.infra.memoryUtilizationPct ?? 0;
    return 0;
  };

  return ALERT_RULES.map((rule) => {
    let currentValue = 0;
    if (rule.metric.endsWith('_ms') && rule.metric !== 'db_connection_pool_utilization') {
      currentValue = histP95(rule.metric);
    } else {
      currentValue = counterProxy(rule.metric);
    }

    let firing = false;
    switch (rule.condition) {
      case 'gt':
        firing = currentValue > rule.threshold;
        break;
      case 'gte':
        firing = currentValue >= rule.threshold;
        break;
      case 'lt':
        firing = currentValue < rule.threshold;
        break;
      case 'lte':
        firing = currentValue <= rule.threshold;
        break;
      case 'rate_gt':
        firing = currentValue > rule.threshold;
        break;
    }

    return {
      ruleId: rule.id,
      name: rule.name,
      severity: rule.severity,
      firing,
      currentValue,
      threshold: rule.threshold,
      message: firing ? `${rule.description} (current: ${currentValue})` : rule.description,
    };
  });
}
