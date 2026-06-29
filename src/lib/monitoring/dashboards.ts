/**
 * Vendor-neutral dashboard definitions — import into Grafana, Datadog, or custom UI.
 */
export type DashboardPanel = {
  id: string;
  title: string;
  type: 'stat' | 'timeseries' | 'gauge' | 'table' | 'heatmap';
  metrics: string[];
  query?: string;
  description?: string;
};

export type DashboardDefinition = {
  id: string;
  title: string;
  description: string;
  refreshIntervalSec: number;
  panels: DashboardPanel[];
};

export const DASHBOARDS: DashboardDefinition[] = [
  {
    id: 'platform-overview',
    title: 'Platform Overview',
    description: 'Top-level SLOs: latency, errors, throughput',
    refreshIntervalSec: 30,
    panels: [
      { id: 'rpc-p95', title: 'RPC P95 Latency', type: 'timeseries', metrics: ['rpc_duration_ms'], query: 'histogram_quantile(0.95, rpc_duration_ms)' },
      { id: 'rpc-errors', title: 'RPC Error Rate', type: 'stat', metrics: ['rpc_errors_total', 'rpc_calls_total'] },
      { id: 'checkout-rate', title: 'Checkout Success Rate', type: 'gauge', metrics: ['checkout_success_rate'] },
      { id: 'orders', title: 'Orders Created', type: 'stat', metrics: ['orders_created_total'] },
      { id: 'errors', title: 'Errors by Category', type: 'table', metrics: ['errors_by_category_total'] },
    ],
  },
  {
    id: 'storefront-performance',
    title: 'Storefront Performance',
    description: 'Page views, bundle load, cache hit rate',
    refreshIntervalSec: 60,
    panels: [
      { id: 'page-views', title: 'Store Visits', type: 'timeseries', metrics: ['storefront_page_views_total', 'store_visits_total'] },
      { id: 'bundle-load', title: 'Bundle Load P95', type: 'timeseries', metrics: ['storefront_bundle_load_ms'] },
      { id: 'sf-cache', title: 'Storefront Cache Hit Rate', type: 'gauge', metrics: ['cache_hit_rate'], query: 'domain=storefront' },
      { id: 'web-vitals', title: 'Web Vitals', type: 'timeseries', metrics: ['web_vitals.lcp', 'web_vitals.cls', 'web_vitals.ttfb'] },
    ],
  },
  {
    id: 'database-health',
    title: 'Database Health',
    description: 'Query duration, slow queries, pool, latency',
    refreshIntervalSec: 30,
    panels: [
      { id: 'query-p95', title: 'Query P95', type: 'timeseries', metrics: ['db_query_duration_ms'] },
      { id: 'slow-queries', title: 'Slow Queries', type: 'stat', metrics: ['db_slow_queries_total'] },
      { id: 'pool', title: 'Connection Pool Utilization', type: 'gauge', metrics: ['db_connection_pool_utilization'] },
      { id: 'db-latency', title: 'DB Latency', type: 'timeseries', metrics: ['db_latency_ms'] },
      { id: 'health-domains', title: 'Domain Health', type: 'table', metrics: ['health.*.failure'] },
    ],
  },
  {
    id: 'queue-health',
    title: 'Queue Health',
    description: 'Backlog, throughput, dead letter',
    refreshIntervalSec: 15,
    panels: [
      { id: 'depth', title: 'Queue Depth', type: 'timeseries', metrics: ['background_queue_depth'] },
      { id: 'throughput', title: 'Job Throughput', type: 'stat', metrics: ['background_job_throughput'] },
      { id: 'dead-letter', title: 'Dead Letter Count', type: 'stat', metrics: ['background_dead_letter_total'] },
      { id: 'job-duration', title: 'Job Duration P95', type: 'timeseries', metrics: ['background_job_duration_ms'] },
    ],
  },
  {
    id: 'cache-health',
    title: 'Cache Health',
    description: 'Hit rate, invalidations, failures by domain',
    refreshIntervalSec: 60,
    panels: [
      { id: 'hit-rate', title: 'Aggregate Hit Rate', type: 'gauge', metrics: ['cache_hit_rate'] },
      { id: 'hits-misses', title: 'Hits vs Misses', type: 'timeseries', metrics: ['cache_hits_total', 'cache_misses_total'] },
      { id: 'invalidations', title: 'Invalidations', type: 'stat', metrics: ['cache_invalidations_total'] },
      { id: 'cache-failures', title: 'Cache Failures', type: 'stat', metrics: ['cache_failures_total'] },
    ],
  },
  {
    id: 'background-workers',
    title: 'Background Workers',
    description: 'Worker utilization, job outcomes',
    refreshIntervalSec: 30,
    panels: [
      { id: 'utilization', title: 'Worker Utilization', type: 'gauge', metrics: ['background_worker_utilization'] },
      { id: 'jobs', title: 'Jobs by Status', type: 'table', metrics: ['background_jobs_total'] },
      { id: 'retries', title: 'Job Retries', type: 'stat', metrics: ['background_jobs_total'], query: 'status=retry' },
    ],
  },
  {
    id: 'edge-functions',
    title: 'Edge Functions',
    description: 'Invocations, duration, errors',
    refreshIntervalSec: 60,
    panels: [
      { id: 'invocations', title: 'Invocations', type: 'timeseries', metrics: ['edge_invocations_total'] },
      { id: 'edge-p95', title: 'Edge P95', type: 'timeseries', metrics: ['edge_duration_ms'] },
      { id: 'edge-errors', title: 'Edge Errors', type: 'stat', metrics: ['edge_errors_total'] },
    ],
  },
  {
    id: 'business-kpis',
    title: 'Business KPIs',
    description: 'Orders, registrations, checkout funnel',
    refreshIntervalSec: 300,
    panels: [
      { id: 'orders-created', title: 'Orders Created', type: 'stat', metrics: ['orders_created_total'] },
      { id: 'checkout-funnel', title: 'Checkout Funnel', type: 'table', metrics: ['checkout_started_total', 'checkout_success_total', 'checkout_failed_total'] },
      { id: 'registrations', title: 'Registrations', type: 'stat', metrics: ['customer_registrations_total'] },
      { id: 'products', title: 'Products Created', type: 'stat', metrics: ['products_created_total'] },
    ],
  },
  {
    id: 'system-errors',
    title: 'System Errors',
    description: 'Error taxonomy, circuit breakers, health domains',
    refreshIntervalSec: 30,
    panels: [
      { id: 'errors-total', title: 'Total Errors', type: 'stat', metrics: ['errors_total'] },
      { id: 'by-category', title: 'By Category', type: 'table', metrics: ['errors_by_category_total'] },
      { id: 'circuit-breakers', title: 'Circuit Breakers', type: 'table', metrics: ['circuit_breaker.state'] },
      { id: 'replica-fallback', title: 'Replica Fallbacks', type: 'stat', metrics: ['rpc_replica_fallback_total'] },
    ],
  },
];

export function getDashboardById(id: string): DashboardDefinition | undefined {
  return DASHBOARDS.find((d) => d.id === id);
}

export function listDashboards(): Pick<DashboardDefinition, 'id' | 'title' | 'description'>[] {
  return DASHBOARDS.map(({ id, title, description }) => ({ id, title, description }));
}
