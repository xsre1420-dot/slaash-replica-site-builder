/**
 * Distributed span engine — parent/child propagation, timing, storage.
 */
import { buildEventBase } from '@/lib/observability/context';
import { enqueueEvent } from '@/lib/observability/reporter';
import { logger } from '@/lib/observability/logger';
import { timing } from '@/lib/observability/metrics';
import {
  createTraceContext,
  pushTraceContext,
  popTraceContext,
  type TraceStage,
} from './traceContext';
import { recordSpan } from './spanStore';
import { resolveFlowStage } from './criticalFlows';
import { detectBottlenecksForTrace } from './bottleneckDetector';

export interface SpanHandle {
  spanId: string;
  traceId: string;
  setAttribute: (key: string, value: unknown) => void;
  setStage: (stage: TraceStage) => void;
}

export const traceSpan = async <T>(
  name: string,
  fn: (span: SpanHandle) => Promise<T>,
  attributes?: Record<string, unknown>
): Promise<T> => {
  const mapped = resolveFlowStage(name);
  const flow = (attributes?.flow as string | undefined) ?? mapped.flow;
  const stage = (attributes?.stage as TraceStage | undefined) ?? mapped.stage;

  const ctx = createTraceContext({ flow, stage });
  pushTraceContext(ctx);

  const base = buildEventBase();
  const attrs: Record<string, unknown> = { ...attributes, flow, stage };
  const started = performance.now();
  const startedAt = Date.now();

  const span: SpanHandle = {
    spanId: ctx.spanId,
    traceId: ctx.traceId,
    setAttribute: (key, value) => {
      attrs[key] = value;
    },
    setStage: (s) => {
      attrs.stage = s;
    },
  };

  try {
    const result = await fn(span);
    const durationMs = performance.now() - started;

    timing(`span.${name}`, durationMs, { status: 'ok', flow: flow ?? 'unknown' });
    enqueueEvent({
      type: 'span',
      name,
      durationMs,
      status: 'ok',
      spanId: ctx.spanId,
      parentSpanId: ctx.parentSpanId,
      attributes: attrs,
      ...base,
      correlationId: ctx.correlationId,
      requestId: ctx.requestId,
    });

    recordSpan({
      traceId: ctx.traceId,
      spanId: ctx.spanId,
      parentSpanId: ctx.parentSpanId,
      correlationId: ctx.correlationId,
      requestId: ctx.requestId,
      name,
      flow,
      stage: (attrs.stage as TraceStage | undefined) ?? stage,
      startedAt,
      endedAt: Date.now(),
      durationMs: Math.round(durationMs),
      status: 'ok',
      attributes: attrs,
    });

    return result;
  } catch (error) {
    const durationMs = performance.now() - started;
    const message = error instanceof Error ? error.message : String(error);

    timing(`span.${name}`, durationMs, { status: 'error', flow: flow ?? 'unknown' });
    enqueueEvent({
      type: 'span',
      name,
      durationMs,
      status: 'error',
      spanId: ctx.spanId,
      parentSpanId: ctx.parentSpanId,
      attributes: attrs,
      error: message,
      ...base,
      correlationId: ctx.correlationId,
      requestId: ctx.requestId,
    });

    recordSpan({
      traceId: ctx.traceId,
      spanId: ctx.spanId,
      parentSpanId: ctx.parentSpanId,
      correlationId: ctx.correlationId,
      requestId: ctx.requestId,
      name,
      flow,
      stage: (attrs.stage as TraceStage | undefined) ?? stage,
      startedAt,
      endedAt: Date.now(),
      durationMs: Math.round(durationMs),
      status: 'error',
      attributes: attrs,
      error: message,
    });

    detectBottlenecksForTrace(ctx.traceId);

    logger.error(`Span failed: ${name}`, { spanId: ctx.spanId, flow, stage, ...attrs }, error);
    throw error;
  } finally {
    popTraceContext();
  }
};

/** Backward-compatible alias — accepts fn with or without span handle. */
export const withSpan = async <T>(
  name: string,
  fn: ((span: SpanHandle) => Promise<T>) | (() => Promise<T>),
  attributes?: Record<string, unknown>
): Promise<T> =>
  traceSpan(name, async (span) => {
    if (fn.length === 0) return (fn as () => Promise<T>)();
    return (fn as (span: SpanHandle) => Promise<T>)(span);
  }, attributes);
