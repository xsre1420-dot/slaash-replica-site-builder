import { withSpan } from './tracing';
import { logger } from './logger';
import { increment } from './metrics';
import { alertOnError } from './alerting';

export const instrumentAsync = async <T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> => {
  increment(`operation.${operation}.started`);
  try {
    const result = await withSpan(operation, async () => fn(), context);
    increment(`operation.${operation}.success`);
    return result;
  } catch (error) {
    increment(`operation.${operation}.failed`);
    alertOnError(operation, error, context);
    throw error;
  }
};

export const instrumentQuery = async <T>(
  operation: string,
  fn: () => Promise<{ data: T | null; error: { message: string; code?: string } | null }>,
  context?: Record<string, unknown>
): Promise<T | null> => {
  return instrumentAsync(operation, async () => {
    const { data, error } = await fn();
    if (error) {
      logger.error(`Query failed: ${operation}`, {
        ...context,
        code: error.code,
        message: error.message,
      });
      throw new Error(error.message);
    }
    return data;
  }, context);
};
