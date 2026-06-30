import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateIncidents,
  getAlertCatalogue,
  getAlertAuditSummary,
  classifyIncidentSeverity,
  INCIDENT_SEVERITY_MATRIX,
  getPlaybook,
  listPlaybooks,
  computeHealthIndicators,
  computeOperationalReadiness,
  exportEnterpriseAlerts,
  resetAlertingForTests,
  resetOperationalReadinessForTests,
  SUPPORTED_VENDORS,
  ENTERPRISE_ALERT_POLICIES,
} from '@/lib/alerting';
import { resetMetricCollectorForTests } from '@/lib/monitoring';
import { getPlatformMetricsSnapshot } from '@/lib/monitoring/snapshot';

describe('enterprise alerting', () => {
  beforeEach(() => {
    resetMetricCollectorForTests();
    resetAlertingForTests();
    resetOperationalReadinessForTests();
  });

  it('audit registry resolves all gaps', () => {
    const audit = getAlertAuditSummary();
    expect(audit.resolved).toBe(audit.total);
    expect(audit.coverageAfterPct).toBeGreaterThanOrEqual(95);
  });

  it('catalogue includes base and enterprise policies', () => {
    const catalogue = getAlertCatalogue();
    expect(catalogue.length).toBeGreaterThanOrEqual(18);
    expect(catalogue.some((c) => c.id === 'high-api-latency')).toBe(true);
    expect(catalogue.some((c) => c.id === 'checkout-failure')).toBe(true);
  });

  it('classifies incident severity', () => {
    expect(classifyIncidentSeverity('checkout-failure', 'critical', true)).toBe('critical');
    expect(classifyIncidentSeverity('high-latency-rpc', 'warning', true)).toBe('high');
    expect(classifyIncidentSeverity('infra-memory', 'warning', false)).toBe('informational');
  });

  it('severity matrix defines escalation priorities', () => {
    expect(INCIDENT_SEVERITY_MATRIX.critical.pageOnCall).toBe(true);
    expect(INCIDENT_SEVERITY_MATRIX.critical.escalationPriority).toBe(1);
    expect(INCIDENT_SEVERITY_MATRIX.informational.escalationPriority).toBe(5);
  });

  it('playbooks exist for critical alerts', () => {
    const playbooks = listPlaybooks();
    expect(playbooks.length).toBeGreaterThanOrEqual(10);
    expect(getPlaybook('checkout-failure')?.immediateActions.length).toBeGreaterThan(0);
    expect(getPlaybook('high-error-rate')?.escalationPath.length).toBeGreaterThan(0);
  });

  it('dedupes pool saturation and exhaustion', () => {
    const snapshot = getPlatformMetricsSnapshot();
    snapshot.gauges.push({ name: 'db_connection_pool_utilization', value: 96, labels: {} });
    const status = evaluateIncidents(snapshot);
    const poolAlerts = status.incidents.filter(
      (i) => i.firing && i.dedupeKey === 'database.pool'
    );
    expect(poolAlerts.length).toBeLessThanOrEqual(1);
  });

  it('computes health indicators for all subsystems', () => {
    const snapshot = getPlatformMetricsSnapshot();
    const indicators = computeHealthIndicators(snapshot);
    const names = indicators.map((i) => i.subsystem);
    expect(names).toContain('application');
    expect(names).toContain('database');
    expect(names).toContain('edge_functions');
    expect(names).toContain('search');
  });

  it('operational readiness meets target scores', () => {
    const readiness = computeOperationalReadiness(98, 0);
    expect(readiness.readinessScore).toBeGreaterThanOrEqual(95);
    expect(readiness.errorBudget.sloTargetPct).toBe(99.9);
  });

  it('enterprise status scores target 95+', () => {
    const status = evaluateIncidents();
    expect(status.scores.alertCoverage).toBeGreaterThanOrEqual(95);
    expect(status.scores.incidentReadiness).toBeGreaterThanOrEqual(95);
    expect(status.scores.productionReadiness).toBeGreaterThanOrEqual(95);
  });

  it('exports vendor-neutral alert formats', () => {
    expect(SUPPORTED_VENDORS).toContain('grafana');
    expect(SUPPORTED_VENDORS).toContain('pagerduty');
    expect(SUPPORTED_VENDORS).toContain('datadog');
    const exported = exportEnterpriseAlerts('grafana');
    expect(exported.format).toBe('grafana');
  });

  it('covers required enterprise policy categories', () => {
    const categories = new Set(ENTERPRISE_ALERT_POLICIES.map((p) => p.category));
    expect(categories.has('edge')).toBe(true);
    expect(categories.has('auth')).toBe(true);
    expect(categories.has('storage')).toBe(true);
  });
});
