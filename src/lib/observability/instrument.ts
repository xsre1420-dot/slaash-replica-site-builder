import { recordDatabaseQuery } from '@/lib/monitoring/instrumentation';
import { withSpan } from './tracing';
import { logger } from './logger';
import { increment } from './metrics';
import { alertOnError } from './alerting';
import { recordDatabaseFailure, recordDatabaseSuccess, SLOW_QUERY_THRESHOLD_MS } from './healthMonitor';

export const instrumentAsync = async <T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> => {
  const started = Date.now();
  increment(`operation.${operation}.started`);
  try {
    const result = await withSpan(operation, async () => fn(), context);
    increment(`operation.${operation}.success`);
    recordDatabaseSuccess(operation, Date.now() - started);
    return result;
  } catch (error) {
    increment(`operation.${operation}.failed`);
    recordDatabaseFailure(operation, error instanceof Error ? error.message : String(error), Date.now() - started);
    alertOnError(operation, error, context);
    throw error;
  }
};

export const instrumentQuery = async <T>(
  operation: string,
  fn: () => Promise<{ data: T | null; error: { message: string; code?: string } | null }>,
  context?: Record<string, unknown>
): Promise<T | null> => {
  const started = Date.now();
  return instrumentAsync(operation, async () => {
    const { data, error } = await fn();
    const durationMs = Date.now() - started;
    const slow = durationMs >= SLOW_QUERY_THRESHOLD_MS;
    if (slow) {
      logger.warn(`Slow query: ${operation}`, { ...context, durationMs });
      increment('database.query.slow', { operation: operation.slice(0, 40) });
    }
    recordDatabaseQuery({
      operation,
      durationMs,
      slow,
      status: error ? 'error' : 'ok',
    });
    if (error) {
      logger.error(`Query failed: ${operation}`, {
        ...context,
        code: error.code,
        message: error.message,
        durationMs,
      });
      throw new Error(error.message);
    }
    return data;
  }, { ...context, stage: 'database' });
};
