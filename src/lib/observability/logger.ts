import type { LogLevel } from './types';
import { buildEventBase } from './context';
import { enqueueEvent } from './reporter';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
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
  const err =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error
        ? { name: 'Error', message: String(error) }
        : undefined;

  writeDevConsole(level, message, { ...context, ...base, error: err });

  enqueueEvent({
    type: 'log',
    level,
    message,
    ...base,
    context,
    error: err,
  });
};

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => log('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>, error?: unknown) =>
    log('warn', message, context, error),
  error: (message: string, context?: Record<string, unknown>, error?: unknown) =>
    log('error', message, context, error),
};

export const reportError = (
  error: unknown,
  context?: Record<string, unknown>
) => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error(err.message, { ...context, source: context?.source || 'unknown' }, err);
};
