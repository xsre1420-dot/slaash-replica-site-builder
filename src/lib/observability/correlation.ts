/**
 * Correlation ID propagation — frontend, RPC, edge, background jobs.
 * Header contract matches supabase/functions/_shared/observability.ts.
 */
import type { CorrelationContext } from './types';
import { generateUUID } from '@/lib/uuid';
import { buildTracePropagationHeaders } from '@/lib/tracing/w3cTraceContext';
import { isProduction } from '@/lib/env';

export const CORRELATION_HEADERS = {
  correlationId: 'x-correlation-id',
  requestId: 'x-request-id',
  traceId: 'x-trace-id',
} as const;

const SESSION_KEY = 'obs:session-id';
const TRACE_KEY = 'obs:trace-id';
const CORRELATION_KEY = 'obs:correlation-id';

const generateId = (): string => generateUUID();

const readOrCreate = (key: string): string => {
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = generateId();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return generateId();
  }
};

let currentRoute = typeof window !== 'undefined' ? window.location.pathname : undefined;
let currentUserId: string | undefined;
let currentMerchantId: string | undefined;
let currentStoreId: string | undefined;
let testOverrides: Partial<CorrelationContext> | null = null;

export const setObservabilityRoute = (route: string) => {
  currentRoute = route;
};

export const setObservabilityUser = (userId: string | null | undefined) => {
  currentUserId = userId || undefined;
};

export const setObservabilityTenant = (options: {
  merchantId?: string | null;
  storeId?: string | null;
}) => {
  currentMerchantId = options.merchantId || undefined;
  currentStoreId = options.storeId || undefined;
};

export const newTrace = (): string => {
  const traceId = generateId();
  try {
    sessionStorage.setItem(TRACE_KEY, traceId);
  } catch {
    /* ignore */
  }
  return traceId;
};

export const newRequestId = (): string => generateId();

export const getCorrelationContext = (): CorrelationContext => {
  if (testOverrides) {
    return {
      sessionId: testOverrides.sessionId ?? 'test-session',
      traceId: testOverrides.traceId ?? 'test-trace',
      correlationId: testOverrides.correlationId ?? 'test-correlation',
      userId: testOverrides.userId,
      merchantId: testOverrides.merchantId,
      storeId: testOverrides.storeId,
      route: testOverrides.route,
      environment: testOverrides.environment ?? 'test',
    };
  }

  return {
    sessionId: readOrCreate(SESSION_KEY),
    traceId: readOrCreate(TRACE_KEY),
    correlationId: readOrCreate(CORRELATION_KEY),
    userId: currentUserId,
    merchantId: currentMerchantId,
    storeId: currentStoreId,
    route: currentRoute,
    environment: import.meta.env.VITE_APP_ENV ?? (isProduction() ? 'production' : 'development'),
  };
};

export const buildEventBase = () => {
  const ctx = getCorrelationContext();
  return {
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    traceId: ctx.traceId,
    correlationId: ctx.correlationId,
    userId: ctx.userId,
    merchantId: ctx.merchantId,
    storeId: ctx.storeId,
    route: ctx.route,
    environment: ctx.environment,
    severity: undefined as string | undefined,
  };
};

export const buildCorrelationHeaders = (requestId?: string): Record<string, string> => {
  const ctx = getCorrelationContext();
  const rid = requestId ?? newRequestId();
  const active = buildTracePropagationHeaders();
  return {
    [CORRELATION_HEADERS.correlationId]: ctx.correlationId,
    [CORRELATION_HEADERS.requestId]: rid,
    [CORRELATION_HEADERS.traceId]: ctx.traceId,
    ...active,
  };
};

export async function runWithJobContext<T>(
  fields: { correlationId?: string; requestId?: string; jobId?: string; queue?: string },
  fn: () => Promise<T>
): Promise<T> {
  const requestId = fields.requestId ?? newRequestId();
  const ctx = getCorrelationContext();
  const correlationId = fields.correlationId ?? ctx.correlationId;
  return fn();
}

export const resetCorrelationForTests = () => {
  testOverrides = null;
  currentUserId = undefined;
  currentMerchantId = undefined;
  currentStoreId = undefined;
  currentRoute = undefined;
};

export const setCorrelationForTests = (ctx: Partial<CorrelationContext>) => {
  testOverrides = ctx;
};
