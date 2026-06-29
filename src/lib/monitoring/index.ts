import { initObservability as initObsBase, type ObservabilityConfig } from '@/lib/observability';
import { initTracing } from '@/lib/tracing';
import { getPlatformMetricsSnapshot } from './snapshot';
import { evaluateAlertRules } from './alertRules';
import { listDashboards, DASHBOARDS, getDashboardById } from './dashboards';
import { getMetricsAuditSummary, METRICS_AUDIT_REGISTRY } from './metricsAudit';
import { METRIC_NAMES } from './metricRegistry';
import { formatPrometheusMetrics } from './exporters/prometheusExporter';
import { formatOtelMetrics } from './exporters/otelMetricsExporter';
import {
  recordHttpRequest,
  recordRpcCall,
  recordRpcReplicaFallback,
  recordEdgeFunction,
  recordBackgroundJob,
  recordQueueDepth,
  recordCheckout,
  recordStorefrontPageView,
  recordStorefrontBundleLoad,
  recordDashboardLoad,
  recordDashboardStatsFetch,
  recordSearchQuery,
  recordProductApi,
  recordInventoryUpdate,
  recordStatisticsFetch,
  recordDatabaseQuery,
  recordDatabasePoolUtilization,
  recordDatabaseLatency,
  recordCacheOperation,
  recordCacheHitRate,
  recordBusinessEvent,
  recordJobThroughput,
  recordInfraMemoryUtilization,
  recordError,
  syncObservabilityMetric,
} from './instrumentation';
import {
  getCounterSnapshot,
  getGaugeSnapshot,
  getHistogramSnapshot,
  resetMetricCollectorForTests,
} from './metricCollector';

export type MonitoringConfig = ObservabilityConfig & {
  /** Sample memory gauge every N ms (default 60_000, 0 = disabled) */
  memorySampleIntervalMs?: number;
};

let memoryTimer: ReturnType<typeof setInterval> | null = null;

function startMemorySampling(intervalMs: number): void {
  if (typeof window === 'undefined' || intervalMs <= 0) return;
  if (memoryTimer) clearInterval(memoryTimer);
  memoryTimer = setInterval(() => {
    try {
      const perf = performance as Performance & {
        memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
      };
      if (perf.memory) {
        const pct = (perf.memory.usedJSHeapSize / perf.memory.jsHeapSizeLimit) * 100;
        recordInfraMemoryUtilization(Math.round(pct * 10) / 10);
      }
    } catch {
      /* ignore */
    }
  }, intervalMs);
}

export function initMonitoring(config: MonitoringConfig = {}): void {
  initObsBase(config);
  initTracing();
  startMemorySampling(config.memorySampleIntervalMs ?? 60_000);
}

export function exportMetricsPrometheus(): string {
  return formatPrometheusMetrics({
    counters: getCounterSnapshot(),
    gauges: getGaugeSnapshot(),
    histograms: getHistogramSnapshot(),
  });
}

export function exportMetricsOtel(resourceAttributes?: Record<string, string>) {
  return formatOtelMetrics({
    counters: getCounterSnapshot(),
    gauges: getGaugeSnapshot(),
    histograms: getHistogramSnapshot(),
    resourceAttributes,
  });
}

export function getMonitoringStatus() {
  const snapshot = getPlatformMetricsSnapshot();
  return {
    snapshot,
    alerts: evaluateAlertRules(snapshot),
    dashboards: listDashboards(),
    audit: getMetricsAuditSummary(),
  };
}

export {
  METRIC_NAMES,
  METRICS_AUDIT_REGISTRY,
  DASHBOARDS,
  getDashboardById,
  listDashboards,
  getPlatformMetricsSnapshot,
  evaluateAlertRules,
  getMetricsAuditSummary,
  resetMetricCollectorForTests,
  recordHttpRequest,
  recordRpcCall,
  recordRpcReplicaFallback,
  recordEdgeFunction,
  recordBackgroundJob,
  recordQueueDepth,
  recordCheckout,
  recordStorefrontPageView,
  recordStorefrontBundleLoad,
  recordDashboardLoad,
  recordDashboardStatsFetch,
  recordSearchQuery,
  recordProductApi,
  recordInventoryUpdate,
  recordStatisticsFetch,
  recordDatabaseQuery,
  recordDatabasePoolUtilization,
  recordDatabaseLatency,
  recordCacheOperation,
  recordCacheHitRate,
  recordBusinessEvent,
  recordJobThroughput,
  recordInfraMemoryUtilization,
  recordError,
  syncObservabilityMetric,
  formatPrometheusMetrics,
  formatOtelMetrics,
};

export type { PlatformMetricsSnapshot } from './snapshot';
export type { DashboardDefinition, DashboardPanel } from './dashboards';
export type { AlertRule, AlertEvaluation } from './alertRules';
