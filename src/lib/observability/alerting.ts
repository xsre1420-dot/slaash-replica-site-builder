import type { AlertSeverity } from './types';
import { buildEventBase } from './context';
import { enqueueEvent } from './reporter';
import { logger } from './logger';
import { increment } from './metrics';

const ERROR_WINDOW_MS = 60_000;
const ERROR_THRESHOLD = 5;
const recentErrors: number[] = [];

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
  if (
    source.includes('checkout') ||
    source.includes('payment') ||
    source.includes('order.create')
  ) {
    sendAlert('critical', `Failure: ${source}`, message, context);
  }
};
