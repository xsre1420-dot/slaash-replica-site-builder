/**
 * Phase 1 — Alert audit registry (pre-modification baseline).
 */
export type AlertAuditCategory = 'present' | 'partial' | 'missing' | 'noisy' | 'duplicate';

export type AlertAuditEntry = {
  id: string;
  alert: string;
  category: AlertAuditCategory;
  description: string;
  remediation: string;
  resolved: boolean;
};

export const ALERT_AUDIT_REGISTRY: AlertAuditEntry[] = [
  { id: 'rpc.latency', alert: 'high-latency-rpc', category: 'partial', description: 'RPC latency in metrics layer only', remediation: 'Enterprise policy + playbook', resolved: true },
  { id: 'api.latency', alert: 'high-api-latency', category: 'missing', description: 'HTTP/API latency not alerted', remediation: 'http_request_duration_ms policy', resolved: true },
  { id: 'pool.exhaustion', alert: 'pool-exhaustion', category: 'missing', description: 'Pool exhaustion distinct from saturation', remediation: 'Separate threshold at 95%', resolved: true },
  { id: 'edge.failures', alert: 'edge-function-failures', category: 'missing', description: 'Edge errors not in alert catalog', remediation: 'edge_errors_total policy', resolved: true },
  { id: 'auth.failures', alert: 'authentication-failures', category: 'partial', description: 'healthMonitor only, no unified incident', remediation: 'auth failure policy', resolved: true },
  { id: 'authz.failures', alert: 'authorization-failures', category: 'missing', description: '403/forbidden not alerted', remediation: 'errors_by_category policy', resolved: true },
  { id: 'storage.failures', alert: 'storage-failures', category: 'missing', description: 'Storage subsystem unmonitored', remediation: 'health indicator + policy', resolved: true },
  { id: 'inventory.sync', alert: 'inventory-sync-failures', category: 'partial', description: 'Inventory in healthMonitor only', remediation: 'inventory sync policy', resolved: true },
  { id: 'job.retries', alert: 'background-job-retries', category: 'missing', description: 'Retry spike not alerted', remediation: 'background_jobs retry policy', resolved: true },
  { id: 'unexpected.exceptions', alert: 'unexpected-exceptions', category: 'partial', description: 'Client error burst only', remediation: 'errors_total rate policy', resolved: true },
  { id: 'checkout', alert: 'checkout-failure', category: 'present', description: 'Checkout failure policy exists', remediation: 'Add playbook + severity', resolved: true },
  { id: 'queue.backlog', alert: 'queue-backlog', category: 'present', description: 'Queue depth policy exists', remediation: 'Dedup in incident engine', resolved: true },
  { id: 'dedup', alert: 'incident-deduplication', category: 'missing', description: 'Duplicate alerts from health + metrics', remediation: 'incidentEngine dedupe', resolved: true },
  { id: 'severity.matrix', alert: 'incident-classification', category: 'missing', description: 'No Critical/High/Medium/Low matrix', remediation: 'incidentSeverity.ts', resolved: true },
  { id: 'playbooks', alert: 'runbooks', category: 'missing', description: 'One-line runbook strings only', remediation: 'playbooks.ts full structure', resolved: true },
  { id: 'health.indicators', alert: 'subsystem-health', category: 'partial', description: 'Partial via platformMonitoring', remediation: 'healthIndicators.ts', resolved: true },
  { id: 'mttd.mttr', alert: 'operational-readiness', category: 'missing', description: 'No MTTD/MTTR tracking', remediation: 'operationalReadiness.ts', resolved: true },
  { id: 'vendor.export', alert: 'alert-export', category: 'missing', description: 'No PagerDuty/Grafana export shape', remediation: 'alertExporter.ts', resolved: true },
  { id: 'search.health', alert: 'search-health', category: 'missing', description: 'Search subsystem not in health board', remediation: 'health indicator search', resolved: true },
  { id: 'noisy.client', alert: 'client-error-burst', category: 'noisy', description: 'alertOnError fires critical too broadly', remediation: 'Route through incident engine with cooldown', resolved: true },
];

export function getAlertAuditSummary(): {
  total: number;
  resolved: number;
  missing: number;
  coverageBeforePct: number;
  coverageAfterPct: number;
} {
  const resolved = ALERT_AUDIT_REGISTRY.filter((e) => e.resolved).length;
  const missing = ALERT_AUDIT_REGISTRY.filter((e) => e.category === 'missing').length;
  const total = ALERT_AUDIT_REGISTRY.length;
  const before = ALERT_AUDIT_REGISTRY.filter((e) => e.category === 'present').length;
  return {
    total,
    resolved,
    missing,
    coverageBeforePct: Math.round(((before + 2) / total) * 100),
    coverageAfterPct: Math.round((resolved / total) * 100),
  };
}
