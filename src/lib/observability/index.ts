import { configureReporter, startReporter, flushEvents } from './reporter';
import { logger, reportError, setLogLevel } from './logger';
import { metrics } from './metrics';
import { withSpan } from './tracing';
import { sendAlert, alertOnError } from './alerting';
import { instrumentAsync, instrumentQuery } from './instrument';
import { initWebVitals } from './vitals';
import {
  getCorrelationContext,
  setObservabilityRoute,
  setObservabilityUser,
  newTrace,
} from './context';
import { isProduction } from '@/lib/env';

export interface ObservabilityConfig {
  webhookUrl?: string;
  sampleRate?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export const initObservability = (config: ObservabilityConfig = {}) => {
  configureReporter({
    webhookUrl: config.webhookUrl,
    sampleRate: config.sampleRate ?? (isProduction() ? 0.25 : 1),
  });

  if (config.logLevel) setLogLevel(config.logLevel);
  else if (isProduction()) setLogLevel('info');

  startReporter();
  initWebVitals();

  logger.info('Observability initialized', {
    env: import.meta.env.VITE_APP_ENV,
    hasWebhook: !!config.webhookUrl,
    sampleRate: config.sampleRate ?? (isProduction() ? 0.25 : 1),
  });

  metrics.increment('app.start');
};

export const registerGlobalErrorHandlers = () => {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    reportError(event.error || event.message, {
      source: 'window.error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
    alertOnError('window.error', event.error || event.message);
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, { source: 'unhandledrejection' });
    alertOnError('unhandledrejection', event.reason);
  });
};

export const shutdownObservability = () => {
  flushEvents(true);
};

export {
  logger,
  reportError,
  metrics,
  withSpan,
  sendAlert,
  alertOnError,
  instrumentAsync,
  instrumentQuery,
  getCorrelationContext,
  setObservabilityRoute,
  setObservabilityUser,
  newTrace,
};
