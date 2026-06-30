/**
 * Phase 6 — Operational readiness (MTTD, MTTR, error budget, availability).
 */
import type { IncidentSeverity } from './incidentSeverity';

export type IncidentRecord = {
  incidentId: string;
  alertId: string;
  severity: IncidentSeverity;
  detectedAt: number;
  acknowledgedAt: number | null;
  resolvedAt: number | null;
  mttdMs: number | null;
  mttrMs: number | null;
};

const incidentHistory: IncidentRecord[] = [];
const MAX_HISTORY = 500;

/** Synthetic SLO: 99.9% availability over 30-day window. */
const ERROR_BUDGET_PCT = 0.1;
const SLO_WINDOW_MS = 30 * 24 * 60 * 60_000;

let lastEvaluationAt = Date.now();
let firingSince = new Map<string, number>();

export function recordIncidentDetection(
  alertId: string,
  severity: IncidentSeverity,
  eventStartedAt?: number
): IncidentRecord {
  const now = Date.now();
  const started = eventStartedAt ?? firingSince.get(alertId) ?? now;
  const record: IncidentRecord = {
    incidentId: `inc-${alertId}-${now}`,
    alertId,
    severity,
    detectedAt: now,
    acknowledgedAt: null,
    resolvedAt: null,
    mttdMs: Math.max(0, now - started),
    mttrMs: null,
  };
  incidentHistory.unshift(record);
  if (incidentHistory.length > MAX_HISTORY) incidentHistory.pop();
  return record;
}

export function acknowledgeIncident(incidentId: string): void {
  const rec = incidentHistory.find((i) => i.incidentId === incidentId);
  if (rec && !rec.acknowledgedAt) rec.acknowledgedAt = Date.now();
}

export function resolveIncident(incidentId: string): void {
  const rec = incidentHistory.find((i) => i.incidentId === incidentId);
  if (rec && !rec.resolvedAt) {
    rec.resolvedAt = Date.now();
    rec.mttrMs = rec.resolvedAt - rec.detectedAt;
  }
}

export function trackFiringState(alertId: string, firing: boolean): void {
  const now = Date.now();
  if (firing) {
    if (!firingSince.has(alertId)) firingSince.set(alertId, now);
  } else {
    firingSince.delete(alertId);
  }
  lastEvaluationAt = now;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export type OperationalReadinessSnapshot = {
  generatedAt: string;
  mttd: { p50Ms: number; p95Ms: number; sampleSize: number; targetMs: number };
  mttr: { p50Ms: number; p95Ms: number; sampleSize: number; targetMs: number };
  errorBudget: {
    sloTargetPct: number;
    budgetRemainingPct: number;
    burnRate: number;
    ready: boolean;
  };
  serviceAvailability: { pct: number; windowMs: number; ready: boolean };
  systemHealthScore: number;
  readinessScore: number;
};

export function computeOperationalReadiness(
  systemHealthScore: number,
  activeCriticalCount: number
): OperationalReadinessSnapshot {
  const mttdSamples = incidentHistory.map((i) => i.mttdMs).filter((v): v is number => v != null);
  const mttrSamples = incidentHistory.map((i) => i.mttrMs).filter((v): v is number => v != null);

  const recentIncidents = incidentHistory.filter(
    (i) => Date.now() - i.detectedAt <= SLO_WINDOW_MS
  );
  const downtimeMs = recentIncidents
    .filter((i) => i.severity === 'critical' || i.severity === 'high')
    .reduce((a, i) => a + (i.mttrMs ?? 5 * 60_000), 0);

  const availabilityPct = Math.max(0, 100 - (downtimeMs / SLO_WINDOW_MS) * 100);
  const budgetUsedPct = 100 - availabilityPct;
  const budgetRemainingPct = Math.max(0, ERROR_BUDGET_PCT - budgetUsedPct);

  const burnRate = activeCriticalCount > 0 ? 1 + activeCriticalCount * 0.2 : 0.05;

  const mttdP50 = percentile(mttdSamples, 50);
  const mttdP95 = percentile(mttdSamples, 95);
  const mttrP50 = percentile(mttrSamples, 50);
  const mttrP95 = percentile(mttrSamples, 95);

  const mttdReady = mttdP95 <= 60_000 || mttdSamples.length === 0;
  const mttrReady = mttrP95 <= 15 * 60_000 || mttrSamples.length === 0;
  const errorBudgetReady = budgetRemainingPct >= ERROR_BUDGET_PCT * 0.5;
  const availabilityReady = availabilityPct >= 99.9;

  let readinessScore = 0;
  readinessScore += mttdReady ? 25 : 10;
  readinessScore += mttrReady ? 25 : 10;
  readinessScore += errorBudgetReady ? 20 : 8;
  readinessScore += availabilityReady ? 20 : 8;
  readinessScore += Math.min(10, systemHealthScore / 10);

  return {
    generatedAt: new Date().toISOString(),
    mttd: {
      p50Ms: mttdP50,
      p95Ms: mttdP95,
      sampleSize: mttdSamples.length,
      targetMs: 60_000,
    },
    mttr: {
      p50Ms: mttrP50,
      p95Ms: mttrP95,
      sampleSize: mttrSamples.length,
      targetMs: 15 * 60_000,
    },
    errorBudget: {
      sloTargetPct: 99.9,
      budgetRemainingPct: Math.round(budgetRemainingPct * 1000) / 1000,
      burnRate: Math.round(burnRate * 100) / 100,
      ready: errorBudgetReady,
    },
    serviceAvailability: {
      pct: Math.round(availabilityPct * 1000) / 1000,
      windowMs: SLO_WINDOW_MS,
      ready: availabilityReady,
    },
    systemHealthScore,
    readinessScore: Math.min(100, Math.round(readinessScore)),
  };
}

export function resetOperationalReadinessForTests(): void {
  incidentHistory.length = 0;
  firingSince.clear();
  lastEvaluationAt = Date.now();
}

export function getIncidentHistory(): readonly IncidentRecord[] {
  return incidentHistory;
}

export function getLastEvaluationAt(): number {
  return lastEvaluationAt;
}
