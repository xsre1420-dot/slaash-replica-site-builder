import { describe, it, expect, beforeEach } from 'vitest';
import {
  incrementCounter,
  observeHistogram,
  setGauge,
  getCounterSnapshot,
  getHistogramSnapshot,
  resetMetricCollectorForTests,
} from '@/lib/monitoring/metricCollector';
import { METRIC_NAMES } from '@/lib/monitoring/metricRegistry';
import {
  recordRpcCall,
  recordCheckout,
  recordDatabaseQuery,
  recordBackgroundJob,
} from '@/lib/monitoring/instrumentation';
import { getPlatformMetricsSnapshot } from '@/lib/monitoring/snapshot';
import { DASHBOARDS } from '@/lib/monitoring/dashboards';
import { ALERT_RULES, evaluateAlertRules } from '@/lib/monitoring/alertRules';
import { formatPrometheusMetrics } from '@/lib/monitoring/exporters/prometheusExporter';
import { formatOtelMetrics } from '@/lib/monitoring/exporters/otelMetricsExporter';
import { getMetricsAuditSummary } from '@/lib/monitoring/metricsAudit';

describe('monitoring foundation', () => {
  beforeEach(() => {
    resetMetricCollectorForTests();
  });

  it('records counters and histograms', () => {
    incrementCounter('test_counter', 1, { label: 'a' });
    observeHistogram('test_hist', 120, { op: 'read' });
    expect(getCounterSnapshot().some((c) => c.name === 'test_counter')).toBe(true);
    expect(getHistogramSnapshot().some((h) => h.name === 'test_hist')).toBe(true);
  });

  it('records RPC metrics', () => {
    recordRpcCall({ rpcName: 'get_store', durationMs: 45, status: 'ok', route: 'primary' });
    const counters = getCounterSnapshot();
    expect(counters.some((c) => c.name === METRIC_NAMES.rpc.callsTotal)).toBe(true);
  });

  it('records checkout funnel metrics', () => {
    recordCheckout({ phase: 'started' });
    recordCheckout({ phase: 'success', durationMs: 800 });
    recordCheckout({ phase: 'failed' });
    const snapshot = getPlatformMetricsSnapshot();
    expect(snapshot.derived.checkoutSuccessRate).toBeGreaterThan(0);
  });

  it('records database slow queries', () => {
    recordDatabaseQuery({ operation: 'orders.list', durationMs: 2500, slow: true, status: 'ok' });
    const snapshot = getPlatformMetricsSnapshot();
    expect(snapshot.derived.slowQueryCount).toBe(1);
  });

  it('records background job outcomes', () => {
    recordBackgroundJob({ queue: 'orders', type: 'test', durationMs: 100, status: 'ok' });
    recordBackgroundJob({ queue: 'webhook', type: 'fail', durationMs: 50, status: 'dead_letter' });
    const snapshot = getPlatformMetricsSnapshot();
    expect(snapshot.derived.deadLetterCount).toBe(1);
  });

  it('defines nine dashboards', () => {
    expect(DASHBOARDS.length).toBeGreaterThanOrEqual(9);
  });

  it('evaluates alert rules without throwing', () => {
    setGauge(METRIC_NAMES.worker.queueDepth, 150, { queue: 'orders' });
    const snapshot = getPlatformMetricsSnapshot();
    const alerts = evaluateAlertRules(snapshot);
    expect(alerts.length).toBe(ALERT_RULES.length);
    expect(alerts.some((a) => a.ruleId === 'queue-backlog')).toBe(true);
  });

  it('exports prometheus format', () => {
    incrementCounter(METRIC_NAMES.business.ordersCreatedTotal);
    const text = formatPrometheusMetrics({
      counters: getCounterSnapshot(),
      gauges: [],
      histograms: [],
    });
    expect(text).toContain('# TYPE');
    expect(text).toContain('orders_created_total');
  });

  it('exports opentelemetry metrics shape', () => {
    incrementCounter(METRIC_NAMES.rpc.callsTotal, 1, { rpc: 'test' });
    const otel = formatOtelMetrics({
      counters: getCounterSnapshot(),
      gauges: [],
      histograms: [],
    });
    expect(otel.resourceMetrics).toHaveLength(1);
    expect(otel.resourceMetrics[0].scopeMetrics[0].metrics.length).toBeGreaterThan(0);
  });

  it('metrics audit registry has resolved entries', () => {
    const summary = getMetricsAuditSummary();
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.resolved).toBeGreaterThan(0);
  });
});
