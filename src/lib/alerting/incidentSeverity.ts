/**
 * Phase 3 — Incident severity classification and escalation priority.
 */
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export type EscalationPriority = 1 | 2 | 3 | 4 | 5;

export const INCIDENT_SEVERITY_MATRIX: Record<
  IncidentSeverity,
  {
    label: string;
    escalationPriority: EscalationPriority;
    pageOnCall: boolean;
    maxResponseMin: number;
    description: string;
  }
> = {
  critical: {
    label: 'Critical',
    escalationPriority: 1,
    pageOnCall: true,
    maxResponseMin: 5,
    description: 'Complete service outage or revenue-impacting failure (checkout, orders, DB)',
  },
  high: {
    label: 'High',
    escalationPriority: 2,
    pageOnCall: true,
    maxResponseMin: 15,
    description: 'Major degradation affecting many merchants or core workflows',
  },
  medium: {
    label: 'Medium',
    escalationPriority: 3,
    pageOnCall: false,
    maxResponseMin: 60,
    description: 'Partial degradation, elevated errors, recoverable with mitigation',
  },
  low: {
    label: 'Low',
    escalationPriority: 4,
    pageOnCall: false,
    maxResponseMin: 240,
    description: 'Minor issues, retries succeeding, non-critical paths',
  },
  informational: {
    label: 'Informational',
    escalationPriority: 5,
    pageOnCall: false,
    maxResponseMin: 1440,
    description: 'Trends, capacity warnings, no immediate action required',
  },
};

/** Map legacy alert severity + policy tier to incident severity. */
export function classifyIncidentSeverity(
  alertId: string,
  legacySeverity: 'info' | 'warning' | 'critical',
  firing: boolean
): IncidentSeverity {
  if (!firing) return 'informational';

  const criticalIds = new Set([
    'high-error-rate',
    'checkout-failure',
    'worker-failures',
    'database-saturation',
    'pool-exhaustion',
    'infra-degradation',
    'storage-failures',
    'edge-function-failures',
  ]);
  const highIds = new Set([
    'high-latency-rpc',
    'high-api-latency',
    'queue-backlog',
    'authentication-failures',
    'authorization-failures',
    'inventory-sync-failures',
    'background-job-retries',
    'unexpected-exceptions',
  ]);

  if (criticalIds.has(alertId) || legacySeverity === 'critical') return 'critical';
  if (highIds.has(alertId)) return 'high';
  if (legacySeverity === 'warning') return 'medium';
  return 'low';
}

export function escalationForSeverity(severity: IncidentSeverity): EscalationPriority {
  return INCIDENT_SEVERITY_MATRIX[severity].escalationPriority;
}
