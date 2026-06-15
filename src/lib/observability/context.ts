import type { CorrelationContext } from './types';

const SESSION_KEY = 'obs:session-id';
const TRACE_KEY = 'obs:trace-id';

import { generateUUID } from '@/lib/uuid';

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

export const setObservabilityRoute = (route: string) => {
  currentRoute = route;
};

export const setObservabilityUser = (userId: string | null | undefined) => {
  currentUserId = userId || undefined;
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

export const getCorrelationContext = (): CorrelationContext => ({
  sessionId: readOrCreate(SESSION_KEY),
  traceId: readOrCreate(TRACE_KEY),
  userId: currentUserId,
  route: currentRoute,
});

export const buildEventBase = () => {
  const ctx = getCorrelationContext();
  return {
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    traceId: ctx.traceId,
    route: ctx.route,
    userId: ctx.userId,
  };
};
