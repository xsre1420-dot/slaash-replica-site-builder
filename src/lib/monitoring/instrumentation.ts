/**
 * Domain instrumentation — records metrics without changing business logic.
 */
import { METRIC_NAMES } from './metricRegistry';
import {
  incrementCounter,
  observeHistogram,
  setGauge,
} from './metricCollector';

export function recordHttpRequest(options: {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  timedOut?: boolean;
}): void {
  const labels = {
    method: options.method,
    path: options.path.slice(0, 80),
    status: String(options.status),
  };
  incrementCounter(METRIC_NAMES.http.requestsTotal, 1, labels);
  observeHistogram(METRIC_NAMES.http.requestDurationMs, options.durationMs, labels);
  if (options.status >= 400) {
    incrementCounter(METRIC_NAMES.http.errorsTotal, 1, labels);
  }
  if (options.timedOut) {
    incrementCounter(METRIC_NAMES.http.timeoutsTotal, 1, labels);
  }
}

export function recordRpcCall(options: {
  rpcName: string;
  durationMs: number;
  status: 'ok' | 'error';
  route?: string;
  errorCategory?: string;
  timedOut?: boolean;
}): void {
  const labels = {
    rpc: options.rpcName.slice(0, 60),
    route: options.route ?? 'primary',
    status: options.status,
  };
  incrementCounter(METRIC_NAMES.rpc.callsTotal, 1, labels);
  observeHistogram(METRIC_NAMES.rpc.durationMs, options.durationMs, labels);
  if (options.status === 'error') {
    incrementCounter(METRIC_NAMES.rpc.errorsTotal, 1, {
      rpc: options.rpcName.slice(0, 60),
      category: options.errorCategory ?? 'unexpected',
    });
  }
  if (options.timedOut) {
    incrementCounter(METRIC_NAMES.rpc.timeoutsTotal, 1, { rpc: options.rpcName.slice(0, 60) });
  }
  if (options.route && options.route !== 'primary') {
    incrementCounter(METRIC_NAMES.infra.replicaUtilization, 1, { route: options.route });
  }
}

export function recordRpcReplicaFallback(reason: string): void {
  incrementCounter(METRIC_NAMES.rpc.replicaFallbackTotal, 1, { reason });
}

export function recordEdgeFunction(options: {
  name: string;
  durationMs: number;
  status: 'ok' | 'error';
}): void {
  const labels = { function: options.name, status: options.status };
  incrementCounter(METRIC_NAMES.edge.invocationsTotal, 1, labels);
  observeHistogram(METRIC_NAMES.edge.durationMs, options.durationMs, labels);
  if (options.status === 'error') {
    incrementCounter(METRIC_NAMES.edge.errorsTotal, 1, { function: options.name });
  }
}

export function recordBackgroundJob(options: {
  queue: string;
  type: string;
  durationMs: number;
  status: 'ok' | 'retry' | 'dead_letter' | 'error';
}): void {
  const labels = { queue: options.queue, type: options.type, status: options.status };
  incrementCounter(METRIC_NAMES.worker.jobsTotal, 1, labels);
  observeHistogram(METRIC_NAMES.worker.durationMs, options.durationMs, labels);
  if (options.status === 'dead_letter') {
    incrementCounter(METRIC_NAMES.worker.deadLetterTotal, 1, { queue: options.queue });
  }
}

export function recordQueueDepth(queue: string, depth: number, utilization: number): void {
  setGauge(METRIC_NAMES.worker.queueDepth, depth, { queue });
  setGauge(METRIC_NAMES.worker.workerUtilization, utilization, { queue });
}

export function recordCheckout(options: {
  phase: 'started' | 'success' | 'failed' | 'recovered' | 'idempotent';
  durationMs?: number;
}): void {
  switch (options.phase) {
    case 'started':
      incrementCounter(METRIC_NAMES.checkout.startedTotal);
      break;
    case 'success':
    case 'recovered':
    case 'idempotent':
      incrementCounter(METRIC_NAMES.checkout.successTotal, 1, { phase: options.phase });
      break;
    case 'failed':
      incrementCounter(METRIC_NAMES.checkout.failedTotal);
      break;
  }
  if (options.durationMs != null) {
    observeHistogram(METRIC_NAMES.checkout.durationMs, options.durationMs);
  }
}

export function recordStorefrontPageView(path: string): void {
  incrementCounter(METRIC_NAMES.storefront.pageViewsTotal, 1, { path: path.slice(0, 80) });
  incrementCounter(METRIC_NAMES.business.storeVisitsTotal);
}

export function recordStorefrontBundleLoad(durationMs: number): void {
  observeHistogram(METRIC_NAMES.storefront.bundleLoadMs, durationMs);
}

export function recordDashboardLoad(durationMs: number, section?: string): void {
  observeHistogram(METRIC_NAMES.dashboard.loadMs, durationMs, section ? { section } : undefined);
}

export function recordDashboardStatsFetch(durationMs: number): void {
  observeHistogram(METRIC_NAMES.dashboard.statsFetchMs, durationMs);
}

export function recordSearchQuery(durationMs: number, status: 'ok' | 'error'): void {
  incrementCounter(METRIC_NAMES.search.queriesTotal, 1, { status });
  observeHistogram(METRIC_NAMES.search.durationMs, durationMs, { status });
}

export function recordProductApi(options: {
  operation: string;
  durationMs: number;
  status: 'ok' | 'error';
  created?: boolean;
}): void {
  const labels = { operation: options.operation, status: options.status };
  incrementCounter(METRIC_NAMES.product.apiCallsTotal, 1, labels);
  observeHistogram(METRIC_NAMES.product.durationMs, options.durationMs, labels);
  if (options.created) {
    incrementCounter(METRIC_NAMES.product.createdTotal);
  }
}

export function recordInventoryUpdate(durationMs: number, status: 'ok' | 'error'): void {
  incrementCounter(METRIC_NAMES.inventory.updatesTotal, 1, { status });
  observeHistogram(METRIC_NAMES.inventory.durationMs, durationMs, { status });
}

export function recordStatisticsFetch(durationMs: number): void {
  incrementCounter(METRIC_NAMES.statistics.queriesTotal);
  observeHistogram(METRIC_NAMES.statistics.fetchMs, durationMs);
}

export function recordDatabaseQuery(options: {
  operation: string;
  durationMs: number;
  slow?: boolean;
  status: 'ok' | 'error';
}): void {
  const labels = { operation: options.operation.slice(0, 40), status: options.status };
  observeHistogram(METRIC_NAMES.database.queryDurationMs, options.durationMs, labels);
  if (options.slow) {
    incrementCounter(METRIC_NAMES.database.slowQueriesTotal, 1, labels);
  }
  if (options.status === 'error') {
    incrementCounter(METRIC_NAMES.errors.total, 1, { domain: 'database' });
  }
}

export function recordDatabasePoolUtilization(pct: number): void {
  setGauge(METRIC_NAMES.database.connectionPoolUtilization, pct);
}

export function recordDatabaseLatency(ms: number): void {
  observeHistogram(METRIC_NAMES.database.latencyMs, ms);
}

export function recordCacheOperation(options: {
  domain: string;
  hit: boolean;
  latencyMs?: number;
  invalidation?: boolean;
  failure?: boolean;
  stale?: boolean;
  origin?: boolean;
}): void {
  const labels = { domain: options.domain };
  if (options.hit) {
    incrementCounter(METRIC_NAMES.cache.hitsTotal, 1, labels);
    if (options.latencyMs != null) {
      observeHistogram('cache_hit_latency_ms', options.latencyMs, labels);
    }
  } else {
    incrementCounter(METRIC_NAMES.cache.missesTotal, 1, labels);
  }
  if (options.invalidation) {
    incrementCounter(METRIC_NAMES.cache.invalidationsTotal, 1, labels);
  }
  if (options.failure) {
    incrementCounter(METRIC_NAMES.cache.failuresTotal, 1, labels);
  }
  if (options.stale) {
    incrementCounter(METRIC_NAMES.cache.staleResponsesTotal, 1, labels);
  }
  if (options.origin) {
    incrementCounter(METRIC_NAMES.cache.originRequestsTotal, 1, labels);
  }
}

export function recordCacheHitRate(domain: string, rate: number): void {
  setGauge(METRIC_NAMES.cache.hitRate, Math.round(rate * 1000) / 10, { domain });
}

export function recordBusinessEvent(
  event: 'order_created' | 'registration' | 'product_created' | 'inventory_update'
): void {
  switch (event) {
    case 'order_created':
      incrementCounter(METRIC_NAMES.business.ordersCreatedTotal);
      break;
    case 'registration':
      incrementCounter(METRIC_NAMES.business.registrationsTotal);
      break;
    case 'product_created':
      incrementCounter(METRIC_NAMES.product.createdTotal);
      break;
    case 'inventory_update':
      incrementCounter(METRIC_NAMES.inventory.updatesTotal, 1, { status: 'ok' });
      break;
  }
}

export function recordJobThroughput(count: number): void {
  setGauge(METRIC_NAMES.business.jobThroughput, count);
}

export function recordInfraMemoryUtilization(pct: number): void {
  setGauge(METRIC_NAMES.infra.memoryUtilization, pct);
}

export function recordError(category: string): void {
  incrementCounter(METRIC_NAMES.errors.byCategory, 1, { category });
  incrementCounter(METRIC_NAMES.errors.total, 1, { category });
}

export function recordAnalyticsQueue(options: {
  queue: string;
  depth: number;
  processingRatePerMin?: number;
  backlogAgeMs?: number;
  failedJobs?: number;
}): void {
  const labels = { queue: options.queue };
  setGauge(METRIC_NAMES.analytics.queueDepth, options.depth, labels);
  if (options.processingRatePerMin != null) {
    setGauge(METRIC_NAMES.analytics.processingRate, options.processingRatePerMin, labels);
  }
  if (options.backlogAgeMs != null) {
    setGauge(METRIC_NAMES.analytics.backlogAgeMs, options.backlogAgeMs, labels);
  }
  if (options.failedJobs != null && options.failedJobs > 0) {
    incrementCounter(METRIC_NAMES.analytics.failedJobsTotal, options.failedJobs, labels);
  }
}

export function recordSideEffectsQueue(options: {
  pending: number;
  workerStaleMinutes?: number | null;
  deadLetter?: number;
  processedLast60s?: number;
}): void {
  setGauge(METRIC_NAMES.sideEffects.pending, options.pending, { queue: 'order_side_effects_outbox' });
  if (options.workerStaleMinutes != null) {
    setGauge(METRIC_NAMES.sideEffects.workerStaleMinutes, options.workerStaleMinutes, {
      worker: 'process_order_side_effects_batch',
    });
  }
  if (options.deadLetter != null && options.deadLetter > 0) {
    setGauge(METRIC_NAMES.sideEffects.deadLetter, options.deadLetter, {
      queue: 'order_side_effects_outbox',
    });
    incrementCounter(METRIC_NAMES.worker.deadLetterTotal, options.deadLetter, {
      queue: 'order_side_effects_outbox',
    });
  }
  if (options.processedLast60s != null) {
    setGauge(METRIC_NAMES.sideEffects.processedRate, options.processedLast60s, {
      queue: 'order_side_effects_outbox',
    });
  }
}

export function recordAnalyticsOutboxSpill(queue: string): void {
  incrementCounter(METRIC_NAMES.analytics.outboxSpillTotal, 1, { queue });
}

export type OrderFailureReason =
  | 'stock'
  | 'transaction'
  | 'duplicate'
  | 'validation'
  | 'rate_limit'
  | 'unknown';

export function recordOrderOutcome(options: {
  status: 'success' | 'failure';
  durationMs?: number;
  reason?: OrderFailureReason;
  idempotent?: boolean;
}): void {
  if (options.status === 'success') {
    if (!options.idempotent) {
      incrementCounter(METRIC_NAMES.orders.createdTotal);
    } else {
      incrementCounter(METRIC_NAMES.orders.duplicateAttemptsTotal);
    }
  } else {
    incrementCounter(METRIC_NAMES.orders.failedTotal, 1, {
      reason: options.reason ?? 'unknown',
    });
    switch (options.reason) {
      case 'stock':
        incrementCounter(METRIC_NAMES.orders.stockFailuresTotal);
        break;
      case 'transaction':
        incrementCounter(METRIC_NAMES.orders.transactionFailuresTotal);
        break;
      case 'duplicate':
        incrementCounter(METRIC_NAMES.orders.duplicateAttemptsTotal);
        break;
    }
  }
  if (options.durationMs != null) {
    observeHistogram(METRIC_NAMES.orders.durationMs, options.durationMs, {
      status: options.status,
    });
  }
}

export type SecurityEventType =
  | 'auth_failure'
  | 'rate_limit'
  | 'cross_tenant'
  | 'webhook_failure';

export function recordSecurityEvent(type: SecurityEventType, surface?: string): void {
  const labels = surface ? { surface } : undefined;
  switch (type) {
    case 'auth_failure':
      incrementCounter(METRIC_NAMES.security.authFailuresTotal, 1, labels);
      recordError('auth.login');
      break;
    case 'rate_limit':
      incrementCounter(METRIC_NAMES.security.rateLimitViolationsTotal, 1, labels);
      recordError('auth.rate_limit');
      break;
    case 'cross_tenant':
      incrementCounter(METRIC_NAMES.security.crossTenantAttemptsTotal, 1, labels);
      recordError('auth.cross_tenant');
      break;
    case 'webhook_failure':
      incrementCounter(METRIC_NAMES.security.webhookFailuresTotal, 1, labels);
      recordError('webhook.delivery');
      break;
  }
}

export function recordServerDatabaseMetrics(options: {
  connectionSaturationPct?: number;
  connectionWait?: number;
  lockWaits?: number;
  dbSizeBytes?: number;
  cpuUtilizationPct?: number;
}): void {
  if (options.connectionSaturationPct != null) {
    recordDatabasePoolUtilization(options.connectionSaturationPct);
  }
  if (options.connectionWait != null) {
    setGauge(METRIC_NAMES.server.dbConnectionWait, options.connectionWait);
  }
  if (options.lockWaits != null) {
    setGauge(METRIC_NAMES.server.dbLockWaits, options.lockWaits);
  }
  if (options.dbSizeBytes != null) {
    setGauge(METRIC_NAMES.server.dbSizeBytes, options.dbSizeBytes);
  }
  if (options.cpuUtilizationPct != null) {
    setGauge(METRIC_NAMES.server.dbCpuUtilization, options.cpuUtilizationPct);
  }
}

export async function syncClientQueueMetrics(): Promise<void> {
  try {
    const { getAllQueueMetrics } = await import('@/background/queues/JobQueue');
    for (const m of getAllQueueMetrics()) {
      recordQueueDepth(m.queue, m.pending, m.processing);
      if (m.queue === 'analytics') {
        recordAnalyticsQueue({
          queue: m.queue,
          depth: m.pending,
          processingRatePerMin: m.processingRatePerMin,
          backlogAgeMs: m.oldestPendingMs,
          failedJobs: m.failed,
        });
      }
    }
  } catch {
    /* optional in SSR/tests */
  }
}

export function syncObservabilityMetric(
  name: string,
  value: number,
  unit: 'count' | 'ms' | 'bytes',
  tags?: Record<string, string>
): void {
  if (unit === 'count') incrementCounter(name, value, tags);
  else if (unit === 'ms') observeHistogram(name, value, tags);
  else setGauge(name, value, tags);
}
