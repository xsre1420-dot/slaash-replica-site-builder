/**
 * Phase 2 — Enterprise alert policies (extends monitoring alertRules).
 */
import type { AlertSeverity } from '@/lib/monitoring/alertRules';

export type EnterpriseAlertPolicy = {
  id: string;
  name: string;
  category:
    | 'api'
    | 'rpc'
    | 'database'
    | 'queue'
    | 'edge'
    | 'cache'
    | 'checkout'
    | 'inventory'
    | 'auth'
    | 'storage'
    | 'jobs'
    | 'errors'
    | 'infra';
  severity: AlertSeverity;
  metric: string;
  condition: 'gt' | 'gte' | 'lt' | 'lte' | 'rate_gt';
  threshold: number;
  windowSec: number;
  description: string;
  dedupeKey?: string;
  enabled: boolean;
};

/** Policies not covered by base ALERT_RULES or requiring enterprise thresholds. */
export const ENTERPRISE_ALERT_POLICIES: EnterpriseAlertPolicy[] = [
  {
    id: 'high-api-latency',
    name: 'High API Latency',
    category: 'api',
    severity: 'warning',
    metric: 'http_request_duration_ms',
    condition: 'gt',
    threshold: 3000,
    windowSec: 300,
    description: 'HTTP/API P95 latency exceeds 3s for 5 minutes',
    dedupeKey: 'latency.http',
    enabled: true,
  },
  {
    id: 'pool-exhaustion',
    name: 'Connection Pool Exhaustion',
    category: 'database',
    severity: 'critical',
    metric: 'db_connection_pool_utilization',
    condition: 'gte',
    threshold: 95,
    windowSec: 60,
    description: 'Connection pool at or above 95% — imminent exhaustion',
    dedupeKey: 'database.pool',
    enabled: true,
  },
  {
    id: 'edge-function-failures',
    name: 'Edge Function Failures',
    category: 'edge',
    severity: 'critical',
    metric: 'edge_errors_total',
    condition: 'rate_gt',
    threshold: 0.05,
    windowSec: 300,
    description: 'Edge function error rate exceeds 5%',
    dedupeKey: 'edge.errors',
    enabled: true,
  },
  {
    id: 'authentication-failures',
    name: 'Authentication Failures',
    category: 'auth',
    severity: 'warning',
    metric: 'errors_by_category_total',
    condition: 'rate_gt',
    threshold: 0.15,
    windowSec: 300,
    description: 'Authentication error rate exceeds 15% (401/login failures)',
    dedupeKey: 'auth.login',
    enabled: true,
  },
  {
    id: 'authorization-failures',
    name: 'Authorization Failures',
    category: 'auth',
    severity: 'warning',
    metric: 'errors_by_category_total',
    condition: 'rate_gt',
    threshold: 0.1,
    windowSec: 300,
    description: 'Authorization error rate exceeds 10% (403/forbidden)',
    dedupeKey: 'auth.forbidden',
    enabled: true,
  },
  {
    id: 'inventory-sync-failures',
    name: 'Inventory Synchronization Failures',
    category: 'inventory',
    severity: 'warning',
    metric: 'inventory_updates_total',
    condition: 'rate_gt',
    threshold: 0.2,
    windowSec: 600,
    description: 'Inventory update failure rate exceeds 20%',
    dedupeKey: 'inventory.sync',
    enabled: true,
  },
  {
    id: 'background-job-retries',
    name: 'Background Job Retry Spike',
    category: 'jobs',
    severity: 'warning',
    metric: 'background_jobs_total',
    condition: 'rate_gt',
    threshold: 0.25,
    windowSec: 900,
    description: 'Background job retry rate exceeds 25% in 15 minutes',
    dedupeKey: 'jobs.retries',
    enabled: true,
  },
  {
    id: 'storage-failures',
    name: 'Storage Failures',
    category: 'storage',
    severity: 'critical',
    metric: 'errors_by_category_total',
    condition: 'gt',
    threshold: 10,
    windowSec: 600,
    description: 'Storage-related errors exceed 10 in 10 minutes',
    dedupeKey: 'storage.errors',
    enabled: true,
  },
  {
    id: 'unexpected-exceptions',
    name: 'Unexpected Exception Rate',
    category: 'errors',
    severity: 'critical',
    metric: 'errors_total',
    condition: 'rate_gt',
    threshold: 0.08,
    windowSec: 300,
    description: 'Unhandled exception rate exceeds 8%',
    dedupeKey: 'errors.unhandled',
    enabled: true,
  },
  {
    id: 'search-degradation',
    name: 'Search Latency Degradation',
    category: 'api',
    severity: 'warning',
    metric: 'search_duration_ms',
    condition: 'gt',
    threshold: 2500,
    windowSec: 600,
    description: 'Search P95 latency exceeds 2.5s',
    dedupeKey: 'search.latency',
    enabled: true,
  },
];

export type EnterprisePolicyEvaluation = {
  policyId: string;
  name: string;
  category: EnterpriseAlertPolicy['category'];
  severity: AlertSeverity;
  firing: boolean;
  currentValue: number;
  threshold: number;
  message: string;
};

type SnapshotLike = {
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
  counters: Array<{ name: string; value: number; labels: Record<string, string> }>;
  health: Array<{ domain: string; failureRate: number; status: string }>;
  infra: { memoryUtilizationPct: number | null };
};

function gaugeValue(snapshot: SnapshotLike, name: string): number {
  return snapshot.gauges.find((g) => g.name === name)?.value ?? 0;
}

function histP95(snapshot: SnapshotLike, name: string): number {
  return snapshot.histograms.find((h) => h.name === name)?.p95 ?? 0;
}

function counterSum(snapshot: SnapshotLike, name: string, labelFilter?: Record<string, string>): number {
  return snapshot.counters
    .filter((c) => c.name === name)
    .filter((c) => {
      if (!labelFilter) return true;
      return Object.entries(labelFilter).every(([k, v]) => c.labels[k] === v);
    })
    .reduce((a, c) => a + c.value, 0);
}

function rateFromCounters(success: number, failed: number): number {
  const total = success + failed;
  return total > 0 ? failed / total : 0;
}

function resolveMetricValue(snapshot: SnapshotLike, policy: EnterpriseAlertPolicy): number {
  switch (policy.metric) {
    case 'http_request_duration_ms':
      return histP95(snapshot, policy.metric);
    case 'search_duration_ms':
      return histP95(snapshot, policy.metric);
    case 'db_connection_pool_utilization':
      return gaugeValue(snapshot, policy.metric);
    case 'edge_errors_total': {
      const invocations = counterSum(snapshot, 'edge_invocations_total');
      const errors = counterSum(snapshot, 'edge_errors_total');
      return invocations > 0 ? errors / invocations : 0;
    }
    case 'errors_by_category_total': {
      if (policy.id === 'authentication-failures') {
        const authErrors = counterSum(snapshot, 'errors_by_category_total', { category: 'auth' });
        const authCalls = counterSum(snapshot, 'rpc_calls_total') || 1;
        return authErrors / authCalls;
      }
      if (policy.id === 'authorization-failures') {
        const forbidden = counterSum(snapshot, 'errors_by_category_total', { category: 'forbidden' });
        const calls = counterSum(snapshot, 'rpc_calls_total') || 1;
        return forbidden / calls;
      }
      if (policy.id === 'storage-failures') {
        return counterSum(snapshot, 'errors_by_category_total', { category: 'storage' });
      }
      return counterSum(snapshot, policy.metric);
    }
    case 'inventory_updates_total': {
      const failed = counterSum(snapshot, 'inventory_updates_total', { outcome: 'failure' });
      const success = counterSum(snapshot, 'inventory_updates_total', { outcome: 'success' });
      return rateFromCounters(success, failed);
    }
    case 'background_jobs_total': {
      const retries = counterSum(snapshot, 'background_jobs_total', { outcome: 'retry' });
      const total = counterSum(snapshot, 'background_jobs_total') || 1;
      return retries / total;
    }
    case 'errors_total': {
      const errors = counterSum(snapshot, 'errors_total');
      const rpcCalls = counterSum(snapshot, 'rpc_calls_total') || 1;
      return errors / rpcCalls;
    }
    default:
      return gaugeValue(snapshot, policy.metric);
  }
}

function evaluateCondition(
  condition: EnterpriseAlertPolicy['condition'],
  current: number,
  threshold: number
): boolean {
  switch (condition) {
    case 'gt':
      return current > threshold;
    case 'gte':
      return current >= threshold;
    case 'lt':
      return current < threshold;
    case 'lte':
      return current <= threshold;
    case 'rate_gt':
      return current > threshold;
    default:
      return false;
  }
}

export function evaluateEnterprisePolicies(snapshot: SnapshotLike): EnterprisePolicyEvaluation[] {
  return ENTERPRISE_ALERT_POLICIES.filter((p) => p.enabled).map((policy) => {
    const currentValue = resolveMetricValue(snapshot, policy);
    const firing = evaluateCondition(policy.condition, currentValue, policy.threshold);
    return {
      policyId: policy.id,
      name: policy.name,
      category: policy.category,
      severity: policy.severity,
      firing,
      currentValue,
      threshold: policy.threshold,
      message: firing
        ? `${policy.description} (current: ${currentValue.toFixed(4)})`
        : policy.description,
    };
  });
}

export function getAlertCatalogue(): Array<{
  id: string;
  name: string;
  source: 'base' | 'enterprise';
  category: string;
  severity: string;
}> {
  const base = [
    'high-latency-rpc',
    'high-error-rate',
    'slow-queries',
    'queue-backlog',
    'worker-failures',
    'database-saturation',
    'cache-failures',
    'checkout-failure',
    'infra-memory',
    'infra-degradation',
  ].map((id) => ({
    id,
    name: id,
    source: 'base' as const,
    category: 'monitoring',
    severity: id.includes('failure') || id.includes('saturation') || id.includes('degradation') ? 'critical' : 'warning',
  }));

  const enterprise = ENTERPRISE_ALERT_POLICIES.map((p) => ({
    id: p.id,
    name: p.name,
    source: 'enterprise' as const,
    category: p.category,
    severity: p.severity,
  }));

  return [...base, ...enterprise];
}
