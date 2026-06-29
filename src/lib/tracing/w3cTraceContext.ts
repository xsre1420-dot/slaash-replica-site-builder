/**
 * W3C Trace Context — traceparent / tracestate headers.
 */
import { getActiveTraceContext } from './traceContext';
import { generateUUID } from '@/lib/uuid';

export const W3C_TRACE_FLAGS = '01';

export function buildTraceparent(traceId?: string, spanId?: string): string {
  const active = getActiveTraceContext();
  const tid = (traceId ?? active?.traceId ?? generateUUID()).replace(/-/g, '');
  const sid = (spanId ?? active?.spanId ?? generateUUID()).replace(/-/g, '').slice(0, 32);
  const normalizedTrace = tid.length === 32 ? tid : tid.padEnd(32, '0').slice(0, 32);
  const normalizedSpan = sid.length === 16 ? sid : sid.slice(0, 16);
  return `00-${normalizedTrace}-${normalizedSpan}-${W3C_TRACE_FLAGS}`;
}

export function parseTraceparent(header: string | null): {
  traceId?: string;
  spanId?: string;
} | null {
  if (!header) return null;
  const parts = header.split('-');
  if (parts.length !== 4 || parts[0] !== '00') return null;
  return { traceId: parts[1], spanId: parts[2] };
}

export function buildTracePropagationHeaders(): Record<string, string> {
  const active = getActiveTraceContext();
  const headers: Record<string, string> = {
    traceparent: buildTraceparent(active?.traceId, active?.spanId),
  };
  if (active?.spanId) headers['x-span-id'] = active.spanId;
  if (active?.parentSpanId) headers['x-parent-span-id'] = active.parentSpanId;
  return headers;
}
