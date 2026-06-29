import type { LogLevel } from './types';
import { buildEventBase } from './correlation';
import { enqueueEvent } from './reporter';
import { sanitizeLogContext, sanitizeErrorMessage } from './sanitizer';
import { classifyError, errorCategorySeverity } from './errorTaxonomy';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 5,
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

let minLevel: LogLevel = import.meta.env.DEV ? 'debug' : 'info';

export const setLogLevel = (level: LogLevel) => {
  minLevel = level;
};

const shouldLog = (level: LogLevel) => LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];

const writeDevConsole = (level: LogLevel, message: string, context?: Record<string, unknown>) => {
  if (!import.meta.env.DEV) return;
  const payload = context ? [message, context] : [message];
  switch (level) {
    case 'trace':
    case 'debug':
      console.debug('[obs]', ...payload);
      break;
    case 'info':
      console.info('[obs]', ...payload);
      break;
    case 'warn':
      console.warn('[obs]', ...payload);
      break;
    case 'error':
    case 'fatal':
      console.error('[obs]', ...payload);
      break;
  }
};

export const log = (
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  error?: unknown
) => {
  if (!shouldLog(level)) return;

  const base = buildEventBase();
  const safeContext = sanitizeLogContext(context);
  const err =
    error instanceof Error
      ? {
          name: error.name,
          message: sanitizeErrorMessage(error.message),
          stack: error.stack,
        }
      : error
        ? { name: 'Error', message: sanitizeErrorMessage(String(error)) }
        : undefined;

  const classified =
    error != null
      ? classifyError(error, {
          code: safeContext?.errorCode as string | undefined,
          hint: safeContext?.errorCategory as import('./errorTaxonomy').ErrorCategory | undefined,
        })
      : undefined;

  const eventContext = {
    ...safeContext,
    errorCategory: safeContext?.errorCategory ?? classified?.category,
    errorCode: safeContext?.errorCode ?? classified?.code,
  };

  writeDevConsole(level, message, { ...eventContext, ...base, error: err });

  enqueueEvent({
    type: 'log',
    level,
    severity: level.toUpperCase(),
    message,
    ...base,
    correlationId: base.correlationId,
    merchantId: base.merchantId,
    storeId: base.storeId,
    environment: base.environment,
    rpcName: safeContext?.rpcName as string | undefined,
    edgeFunction: safeContext?.edgeFunction as string | undefined,
    durationMs: safeContext?.durationMs as number | undefined,
    status: safeContext?.status as string | undefined,
    requestId: safeContext?.requestId as string | undefined,
    errorCategory: eventContext.errorCategory as string | undefined,
    errorCode: eventContext.errorCode as string | undefined,
    context: eventContext,
    error: err,
  });
};

export const logger = {
  trace: (message: string, context?: Record<string, unknown>) => log('trace', message, context),
  debug: (message: string, context?: Record<string, unknown>) => log('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>, error?: unknown) =>
    log('warn', message, context, error),
  error: (message: string, context?: Record<string, unknown>, error?: unknown) =>
    log('error', message, context, error),
  fatal: (message: string, context?: Record<string, unknown>, error?: unknown) =>
    log('fatal', message, context, error),
};

export const reportError = (error: unknown, context?: Record<string, unknown>) => {
  const err = error instanceof Error ? error : new Error(String(error));
  const classified = classifyError(err);
  const level = errorCategorySeverity(classified.category);
  log(
    level === 'fatal' ? 'fatal' : 'error',
    err.message,
    {
      ...context,
      source: context?.source || 'unknown',
      errorCategory: classified.category,
      errorCode: classified.code,
    },
    err
  );
};