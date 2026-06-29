/**
 * In-memory span store for production diagnostics — keyed by traceId.
 */
import type { TraceStage } from './traceContext';

export type StoredSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  correlationId: string;
  requestId: string;
  name: string;
  flow?: string;
  stage?: TraceStage;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  status: 'ok' | 'error';
  attributes: Record<string, unknown>;
  error?: string;
};

const MAX_TRACES = 200;
const MAX_SPANS_PER_TRACE = 128;

const byTraceId = new Map<string, StoredSpan[]>();
const traceOrder: string[] = [];

export function recordSpan(span: StoredSpan): void {
  let list = byTraceId.get(span.traceId);
  if (!list) {
    list = [];
    byTraceId.set(span.traceId, list);
    traceOrder.push(span.traceId);
    while (traceOrder.length > MAX_TRACES) {
      const evict = traceOrder.shift();
      if (evict) byTraceId.delete(evict);
    }
  }
  list.push(span);
  if (list.length > MAX_SPANS_PER_TRACE) {
    list.shift();
  }
}

export function getSpansForTrace(traceId: string): StoredSpan[] {
  return [...(byTraceId.get(traceId) ?? [])];
}

export function findTraceByCorrelationId(correlationId: string): string | null {
  for (const [traceId, spans] of byTraceId) {
    if (spans.some((s) => s.correlationId === correlationId)) return traceId;
  }
  return null;
}

export function getAllStoredTraceIds(): string[] {
  return [...traceOrder];
}

export function resetSpanStoreForTests(): void {
  byTraceId.clear();
  traceOrder.length = 0;
}
