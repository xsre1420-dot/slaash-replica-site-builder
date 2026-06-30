/**
 * Phase 7 — Vendor-neutral alert export (Grafana, PagerDuty, Opsgenie, Datadog, etc.).
 */
import type { IncidentSeverity } from './incidentSeverity';
import type { IncidentPlaybook } from './playbooks';

export type VendorAlertFormat = 'generic' | 'grafana' | 'pagerduty' | 'opsgenie' | 'datadog' | 'newrelic' | 'cloud_monitoring';

export type UnifiedIncident = {
  incidentId: string;
  alertId: string;
  title: string;
  severity: IncidentSeverity;
  escalationPriority: number;
  firing: boolean;
  message: string;
  currentValue: number;
  threshold: number;
  dedupeKey: string;
  playbook?: Pick<IncidentPlaybook, 'title' | 'immediateActions' | 'escalationPath'>;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  detectedAt: string;
};

export type AlertExportPayload = {
  format: VendorAlertFormat;
  incidents: UnifiedIncident[];
  exportedAt: string;
};

function toGrafana(incidents: UnifiedIncident[]) {
  return incidents.map((i) => ({
    labels: { alertname: i.alertId, severity: i.severity, ...i.labels },
    annotations: {
      summary: i.title,
      description: i.message,
      runbook_url: `playbook://${i.alertId}`,
      ...i.annotations,
    },
    startsAt: i.detectedAt,
    status: i.firing ? 'firing' : 'resolved',
  }));
}

function toPagerDuty(incidents: UnifiedIncident[]) {
  return incidents.filter((i) => i.firing).map((i) => ({
    routing_key: '${PAGERDUTY_ROUTING_KEY}',
    event_action: 'trigger',
    dedup_key: i.dedupeKey,
    payload: {
      summary: i.title,
      severity: i.severity === 'critical' ? 'critical' : i.severity === 'high' ? 'error' : 'warning',
      source: 'slaash-platform',
      custom_details: {
        message: i.message,
        currentValue: i.currentValue,
        threshold: i.threshold,
        escalationPriority: i.escalationPriority,
      },
    },
  }));
}

function toOpsgenie(incidents: UnifiedIncident[]) {
  return incidents.filter((i) => i.firing).map((i) => ({
    message: i.title,
    alias: i.dedupeKey,
    priority: i.escalationPriority <= 2 ? 'P1' : i.escalationPriority === 3 ? 'P2' : 'P3',
    description: i.message,
    tags: [i.severity, i.alertId],
    details: i.annotations,
  }));
}

function toDatadog(incidents: UnifiedIncident[]) {
  return incidents.map((i) => ({
    alert_type: i.severity === 'critical' ? 'error' : 'warning',
    title: i.title,
    text: i.message,
    tags: [`alert:${i.alertId}`, `severity:${i.severity}`],
    aggregation_key: i.dedupeKey,
  }));
}

function toNewRelic(incidents: UnifiedIncident[]) {
  return incidents.map((i) => ({
    eventType: 'NrAiIncident',
    title: i.title,
    description: i.message,
    priority: i.escalationPriority,
    tags: { alertId: i.alertId, severity: i.severity },
  }));
}

function toCloudMonitoring(incidents: UnifiedIncident[]) {
  return incidents.map((i) => ({
    displayName: i.title,
    documentation: { content: i.message, mimeType: 'text/markdown' },
    severity: i.severity === 'critical' ? 'CRITICAL' : 'WARNING',
    resourceName: 'slaash-platform',
    conditionName: i.alertId,
  }));
}

export function exportAlerts(
  incidents: UnifiedIncident[],
  format: VendorAlertFormat = 'generic'
): AlertExportPayload {
  let formatted: unknown = incidents;

  switch (format) {
    case 'grafana':
      formatted = toGrafana(incidents);
      break;
    case 'pagerduty':
      formatted = toPagerDuty(incidents);
      break;
    case 'opsgenie':
      formatted = toOpsgenie(incidents);
      break;
    case 'datadog':
      formatted = toDatadog(incidents);
      break;
    case 'newrelic':
      formatted = toNewRelic(incidents);
      break;
    case 'cloud_monitoring':
      formatted = toCloudMonitoring(incidents);
      break;
    default:
      formatted = incidents;
  }

  return {
    format,
    incidents: format === 'generic' ? incidents : (formatted as UnifiedIncident[]),
    exportedAt: new Date().toISOString(),
  };
}

export const SUPPORTED_VENDORS: VendorAlertFormat[] = [
  'generic',
  'grafana',
  'pagerduty',
  'opsgenie',
  'datadog',
  'newrelic',
  'cloud_monitoring',
];
