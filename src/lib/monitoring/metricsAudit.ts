/**
 * Phase 1 — Metrics audit registry (pre-modification baseline + remediation targets).
 */
export type MetricsAuditCategory =
  | 'present'
  | 'partial'
  | 'missing'
  | 'duplicate';

export type MetricsAuditEntry = {
  id: string;
  domain: string;
  metric: string;
  category: MetricsAuditCategory;
  description: string;
  remediation: string;
  resolved: boolean;
};

export const METRICS_AUDIT_REGISTRY: MetricsAuditEntry[] = [
  { id: 'rpc.duration', domain: 'rpc', metric: 'rpc_duration_ms', category: 'missing', description: 'RPC timing not in metrics registry', remediation: 'recordRpcCall in rpc.ts', resolved: true },
  { id: 'rpc.errors', domain: 'rpc', metric: 'rpc_errors_total', category: 'missing', description: 'RPC error counter absent', remediation: 'recordRpcCall error path', resolved: true },
  { id: 'rpc.replica', domain: 'rpc', metric: 'rpc_replica_fallback_total', category: 'missing', description: 'Replica fallback not counted', remediation: 'increment on fallbackToPrimary', resolved: true },
  { id: 'db.slow', domain: 'database', metric: 'db_slow_queries_total', category: 'partial', description: 'Slow queries logged but not in snapshot', remediation: 'recordDatabaseQuery + snapshot', resolved: true },
  { id: 'db.pool', domain: 'database', metric: 'db_connection_pool_utilization', category: 'missing', description: 'Pool utilization not exposed', remediation: 'gauge from health RPC', resolved: true },
  { id: 'worker.depth', domain: 'background', metric: 'background_queue_depth', category: 'partial', description: 'Queue metrics in JobQueue only', remediation: 'sync to metricCollector', resolved: true },
  { id: 'worker.dl', domain: 'background', metric: 'background_dead_letter_total', category: 'partial', description: 'Dead letter not in platform snapshot', remediation: 'recordBackgroundJob', resolved: true },
  { id: 'checkout.rate', domain: 'checkout', metric: 'checkout_success_rate', category: 'partial', description: 'Counters exist, no computed rate', remediation: 'snapshot computes rate', resolved: true },
  { id: 'storefront.views', domain: 'storefront', metric: 'storefront_page_views_total', category: 'partial', description: 'page.view in observability only', remediation: 'bridge to collector', resolved: true },
  { id: 'cache.hitrate', domain: 'cache', metric: 'cache_hit_rate', category: 'partial', description: 'cacheMonitoring separate from metrics', remediation: 'sync cache snapshot', resolved: true },
  { id: 'business.orders', domain: 'business', metric: 'orders_created_total', category: 'missing', description: 'No order creation counter in registry', remediation: 'recordBusinessEvent on order create', resolved: true },
  { id: 'business.registrations', domain: 'business', metric: 'customer_registrations_total', category: 'missing', description: 'Registration counter absent', remediation: 'recordBusinessEvent auth.register', resolved: true },
  { id: 'infra.memory', domain: 'infra', metric: 'infra_memory_utilization', category: 'missing', description: 'No client memory gauge', remediation: 'performance.memory when available', resolved: true },
  { id: 'infra.replica', domain: 'infra', metric: 'read_replica_utilization', category: 'missing', description: 'Replica routing not metered', remediation: 'rpc route label counters', resolved: true },
  { id: 'edge.duration', domain: 'edge', metric: 'edge_duration_ms', category: 'partial', description: 'Edge logs duration, no client metric', remediation: 'edge metric schema + audit RPC', resolved: true },
  { id: 'dashboards', domain: 'platform', metric: 'dashboard_definitions', category: 'missing', description: 'No dashboard catalog', remediation: 'dashboards.ts', resolved: true },
  { id: 'alerts', domain: 'platform', metric: 'alert_rules', category: 'partial', description: 'healthMonitor alerts only', remediation: 'alertRules.ts catalog', resolved: true },
  { id: 'export.prometheus', domain: 'platform', metric: 'prometheus_export', category: 'missing', description: 'No Prometheus text format', remediation: 'prometheusExporter.ts', resolved: true },
  { id: 'http.requests', domain: 'http', metric: 'http_requests_total', category: 'partial', description: 'page.view only, no HTTP layer', remediation: 'recordHttpRequest for fetch/RPC', resolved: true },
  { id: 'search.queries', domain: 'search', metric: 'search_queries_total', category: 'missing', description: 'Search API not metered', remediation: 'recordSearchQuery helper', resolved: true },
];

export function getMetricsAuditSummary(): {
  total: number;
  present: number;
  partial: number;
  missing: number;
  resolved: number;
  coverageBeforePct: number;
  coverageAfterPct: number;
} {
  const present = METRICS_AUDIT_REGISTRY.filter((e) => e.category === 'present').length;
  const partial = METRICS_AUDIT_REGISTRY.filter((e) => e.category === 'partial').length;
  const missing = METRICS_AUDIT_REGISTRY.filter((e) => e.category === 'missing').length;
  const resolved = METRICS_AUDIT_REGISTRY.filter((e) => e.resolved).length;
  const total = METRICS_AUDIT_REGISTRY.length;
  const beforeResolved = METRICS_AUDIT_REGISTRY.filter(
    (e) => e.resolved && e.category === 'present'
  ).length;
  return {
    total,
    present,
    partial,
    missing,
    resolved,
    coverageBeforePct: Math.round(((beforeResolved + partial * 0.5) / total) * 100),
    coverageAfterPct: Math.round((resolved / total) * 100),
  };
}
