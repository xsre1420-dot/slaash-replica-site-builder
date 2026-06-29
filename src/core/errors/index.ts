/**
 * Centralized application error model.
 * Domain mappers remain in utils/ — this layer unifies handling.
 */
import { mapOrderError } from '@/utils/orderErrors';
import { mapProductInsertError } from '@/lib/productUpdateUtils';
import { mapPaymentError } from '@/utils/paymentUtils';

export type ErrorDomain =
  | 'order'
  | 'product'
  | 'payment'
  | 'inventory'
  | 'auth'
  | 'store'
  | 'validation'
  | 'network'
  | 'unknown';

export type ErrorCode = string;

export class AppError extends Error {
  readonly domain: ErrorDomain;
  readonly code: ErrorCode;
  readonly userMessage: string;
  readonly cause?: unknown;

  constructor(options: {
    domain: ErrorDomain;
    code: ErrorCode;
    message: string;
    userMessage?: string;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = 'AppError';
    this.domain = options.domain;
    this.code = options.code;
    this.userMessage = options.userMessage ?? options.message;
    this.cause = options.cause;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function normalizeError(err: unknown, domain: ErrorDomain = 'unknown'): AppError {
  if (isAppError(err)) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new AppError({ domain, code: 'UNEXPECTED', message, userMessage: mapDomainError(message, domain) });
}

export function mapDomainError(message: string, domain: ErrorDomain): string {
  switch (domain) {
    case 'order':
      return mapOrderError(message);
    case 'product':
      return mapProductInsertError(message);
    case 'payment':
      return mapPaymentError(message);
    default:
      return message || 'حدث خطأ غير متوقع';
  }
}

export function fromRpcFailure(
  domain: ErrorDomain,
  payload: { error?: string; message?: string } | null | undefined
): AppError {
  const raw = String(payload?.error ?? payload?.message ?? 'rpc_failed');
  return new AppError({
    domain,
    code: raw,
    message: raw,
    userMessage: mapDomainError(raw, domain),
  });
}

export function logError(err: unknown, context?: Record<string, unknown>): void {
  const normalized = normalizeError(err);
  console.error('[AppError]', {
    domain: normalized.domain,
    code: normalized.code,
    message: normalized.message,
    ...context,
  });
}
