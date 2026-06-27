import type { AlertSeverity } from './types';
import { increment, timing } from './metrics';
import { sendAlert } from './alerting';

/** Monitored platform domains (SRE taxonomy). */
export type HealthDomain =
  | 'product.create'
  | 'product.publish'
  | 'auth.login'
  | 'auth.register'
  | 'checkout'
  | 'order'
  | 'inventory'
  | 'database'
  | 'realtime'
  | 'api';

export type HealthEvent = {
  ts: number;
  success: boolean;
  message?: string;
  durationMs?: number;
};

export type DomainHealthStats = {
  domain: HealthDomain;
  windowMs: number;
  total: number;
  successes: number;
  failures: number;
  failureRate: number;
  slowCount: number;
  lastFailureAt: number | null;
  lastFailureMessage: string | null;
  status: 'healthy' | 'degraded' | 'critical';
};

const DEFAULT_WINDOW_MS = 15 * 60_000;
const SLOW_QUERY_MS = 2_000;

const windows = new Map<HealthDomain, HealthEvent[]>();

const ALERT_RULES: Array<{
  domain: HealthDomain;
  failures: number;
  windowMs: number;
  severity: AlertSeverity;
  title: string;
}> = [
  { domain: 'checkout', failures: 3, windowMs: 5 * 60_000, severity: 'critical', title: 'Checkout failure spike' },
  { domain: 'order', failures: 3, windowMs: 5 * 60_000, severity: 'critical', title: 'Order failure spike' },
  { domain: 'product.create', failures: 5, windowMs: 10 * 60_000, severity: 'warning', title: 'Product creation failures' },
  { domain: 'product.publish', failures: 5, windowMs: 10 * 60_000, severity: 'warning', title: 'Product publish failures' },
  { domain: 'inventory', failures: 5, windowMs: 10 * 60_000, severity: 'warning', title: 'Inventory update failures' },
  { domain: 'auth.login', failures: 15, windowMs: 5 * 60_000, severity: 'warning', title: 'Login failure spike' },
  { domain: 'auth.register', failures: 10, windowMs: 10 * 60_000, severity: 'warning', title: 'Registration failures' },
  { domain: 'database', failures: 5, windowMs: 60_000, severity: 'critical', title: 'Database instability' },
  { domain: 'realtime', failures: 3, windowMs: 5 * 60_000, severity: 'warning', title: 'Realtime connection issues' },
];

const lastAlertAt = new Map<string, number>();
const ALERT_COOLDOWN_MS = 5 * 60_000;

const pruneWindow = (domain: HealthDomain, windowMs = DEFAULT_WINDOW_MS) => {
  const now = Date.now();
  const events = windows.get(domain) ?? [];
  const pruned = events.filter((e) => now - e.ts <= windowMs);
  windows.set(domain, pruned);
  return pruned;
};

const statusForRate = (failureRate: number, failures: number): DomainHealthStats['status'] => {
  if (failures >= 5 && failureRate >= 0.5) return 'critical';
  if (failures >= 2 && failureRate >= 0.25) return 'degraded';
  return 'healthy';
};

export const recordHealthEvent = (
  domain: HealthDomain,
  success: boolean,
  detail?: { message?: string; durationMs?: number }
) => {
  const event: HealthEvent = {
    ts: Date.now(),
    success,
    message: detail?.message,
    durationMs: detail?.durationMs,
  };

  const list = windows.get(domain) ?? [];
  list.push(event);
  windows.set(domain, list);

  increment(success ? `health.${domain}.success` : `health.${domain}.failure`);
  if (detail?.durationMs != null) {
    timing(`health.${domain}.duration`, detail.durationMs);
    if (detail.durationMs >= SLOW_QUERY_MS) {
      increment(`health.${domain}.slow`);
    }
  }

  if (!success) {
    maybeAlertOnDomainThreshold(domain, detail?.message);
  }
};

const maybeAlertOnDomainThreshold = (domain: HealthDomain, message?: string) => {
  const rule = ALERT_RULES.find((r) => r.domain === domain);
  if (!rule) return;

  const events = pruneWindow(domain, rule.windowMs);
  const failures = events.filter((e) => !e.success).length;
  if (failures < rule.failures) return;

  const alertKey = `${domain}:${rule.severity}`;
  const now = Date.now();
  const last = lastAlertAt.get(alertKey) ?? 0;
  if (now - last < ALERT_COOLDOWN_MS) return;

  lastAlertAt.set(alertKey, now);
  sendAlert(rule.severity, rule.title, message ?? `${failures} failures in ${rule.windowMs / 1000}s`, {
    domain,
    failures,
    windowMs: rule.windowMs,
  });
};

export const getDomainHealth = (
  domain: HealthDomain,
  windowMs = DEFAULT_WINDOW_MS
): DomainHealthStats => {
  const events = pruneWindow(domain, windowMs);
  const failures = events.filter((e) => !e.success);
  const successes = events.filter((e) => e.success);
  const total = events.length;
  const failureRate = total > 0 ? failures.length / total : 0;
  const slowCount = events.filter((e) => (e.durationMs ?? 0) >= SLOW_QUERY_MS).length;
  const lastFailure = failures.length > 0 ? failures[failures.length - 1] : null;

  return {
    domain,
    windowMs,
    total,
    successes: successes.length,
    failures: failures.length,
    failureRate,
    slowCount,
    lastFailureAt: lastFailure?.ts ?? null,
    lastFailureMessage: lastFailure?.message ?? null,
    status: statusForRate(failureRate, failures.length),
  };
};

export const getAllDomainHealth = (windowMs = DEFAULT_WINDOW_MS): DomainHealthStats[] => {
  const domains: HealthDomain[] = [
    'product.create',
    'product.publish',
    'auth.login',
    'auth.register',
    'checkout',
    'order',
    'inventory',
    'database',
    'realtime',
    'api',
  ];
  return domains.map((d) => getDomainHealth(d, windowMs));
};

export const recordDatabaseFailure = (operation: string, message: string, durationMs?: number) => {
  recordHealthEvent('database', false, { message: `${operation}: ${message}`, durationMs });
};

export const recordDatabaseSuccess = (operation: string, durationMs?: number) => {
  recordHealthEvent('database', true, { message: operation, durationMs });
};

export const resetHealthMonitorForTests = () => {
  windows.clear();
  lastAlertAt.clear();
};

export const SLOW_QUERY_THRESHOLD_MS = SLOW_QUERY_MS;
