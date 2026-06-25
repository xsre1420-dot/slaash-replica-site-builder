import type { AlertSeverity } from './types';
import { buildEventBase } from './context';
import { enqueueEvent } from './reporter';
import { logger } from './logger';
import { increment } from './metrics';
import { recordHealthEvent, type HealthDomain } from './healthMonitor';

const ERROR_WINDOW_MS = 60_000;
const ERROR_THRESHOLD = 5;
const recentErrors: number[] = [];

const DOMAIN_ALERT_MAP: Array<{ match: string; domain: HealthDomain }> = [
  { match: 'checkout', domain: 'checkout' },
  { match: 'order.create', domain: 'order' },
  { match: 'order.', domain: 'order' },
  { match: 'payment', domain: 'order' },
  { match: 'product.create', domain: 'product.create' },
  { match: 'product.publish', domain: 'product.publish' },
  { match: 'auth.login', domain: 'auth.login' },
  { match: 'auth.register', domain: 'auth.register' },
  { match: 'inventory', domain: 'inventory' },
  { match: 'database', domain: 'database' },
  { match: 'realtime', domain: 'realtime' },
];

const recordErrorForThreshold = () => {
  const now = Date.now();
  recentErrors.push(now);
  while (recentErrors.length > 0 && now - recentErrors[0] > ERROR_WINDOW_MS) {
    recentErrors.shift();
  }
  if (recentErrors.length >= ERROR_THRESHOLD) {
    sendAlert(
      'critical',
      'High client error rate',
      `${ERROR_THRESHOLD}+ errors in ${ERROR_WINDOW_MS / 1000}s`,
      { errorCount: recentErrors.length }
    );
    recentErrors.length = 0;
  }
};

export const sendAlert = (
  severity: AlertSeverity,
  title: string,
  message: string,
  context?: Record<string, unknown>
) => {
  const base = buildEventBase();

  logger.warn(`ALERT: ${title}`, { severity, message, ...context });

  enqueueEvent({
    type: 'alert',
    severity,
    title,
    message,
    context,
    ...base,
  });

  increment('alert.sent', { severity, title: title.slice(0, 40) });
};

export const alertOnError = (source: string, error: unknown, context?: Record<string, unknown>) => {
  recordErrorForThreshold();

  const message = error instanceof Error ? error.message : String(error);
  const mapped = DOMAIN_ALERT_MAP.find((d) => source.includes(d.match));
  if (mapped) {
    recordHealthEvent(mapped.domain, false, { message: `${source}: ${message}` });
  }

  if (
    source.includes('checkout') ||
    source.includes('payment') ||
    source.includes('order.create') ||
    source.includes('product.create') ||
    source.includes('database')
  ) {
    sendAlert('critical', `Failure: ${source}`, message, context);
  }
};
