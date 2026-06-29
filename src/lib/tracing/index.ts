import { getSpansForTrace, getAllStoredTraceIds, resetSpanStoreForTests } from './spanStore';
import { getTraceAuditSummary, TRACE_AUDIT_REGISTRY } from './traceAudit';
import {
  traceSpan,
  withSpan,
  type SpanHandle,
} from './spanEngine';
import {
  traceCriticalFlow,
  CRITICAL_FLOWS,
  FLOW_STAGE_MAP,
  resolveFlowStage,
  type CriticalFlowName,
} from './criticalFlows';
import {
  getTraceDiagnostic,
  getTraceDiagnosticByCorrelationId,
  getTracingStatus,
} from './diagnostics';
import { detectBottlenecks, detectBottlenecksForTrace } from './bottleneckDetector';
import { buildTracePropagationHeaders, buildTraceparent, parseTraceparent } from './w3cTraceContext';
import { formatOtelTraces, formatJaegerTraces } from './exporters/otelTraceExporter';
import {
  getActiveTraceContext,
  runWithTraceContext,
  runWithTraceContextSync,
  createTraceContext,
  resetTraceContextForTests,
  type TraceStage,
  type ActiveTraceContext,
} from './traceContext';

export function initTracing(): void {
  /* Trace context is lazy — no background workers required. */
}

export function exportTracesOtel(traceId?: string) {
  const spans = traceId
    ? getSpansForTrace(traceId)
    : getAllStoredTraceIds().flatMap((id) => getSpansForTrace(id));
  return formatOtelTraces(spans);
}

export function exportTracesJaeger(traceId?: string) {
  const spans = traceId
    ? getSpansForTrace(traceId)
    : getAllStoredTraceIds().flatMap((id) => getSpansForTrace(id));
  return formatJaegerTraces(spans);
}

export function resetTracingForTests(): void {
  resetSpanStoreForTests();
  resetTraceContextForTests();
}

export {
  traceSpan,
  withSpan,
  traceCriticalFlow,
  CRITICAL_FLOWS,
  FLOW_STAGE_MAP,
  resolveFlowStage,
  getTraceDiagnostic,
  getTraceDiagnosticByCorrelationId,
  getTracingStatus,
  detectBottlenecks,
  detectBottlenecksForTrace,
  buildTracePropagationHeaders,
  buildTraceparent,
  parseTraceparent,
  getActiveTraceContext,
  runWithTraceContext,
  runWithTraceContextSync,
  createTraceContext,
  getSpansForTrace,
  getTraceAuditSummary,
  TRACE_AUDIT_REGISTRY,
  formatOtelTraces,
  formatJaegerTraces,
  type SpanHandle,
  type CriticalFlowName,
  type TraceStage,
  type ActiveTraceContext,
};

export type { TraceDiagnostic, TraceTimelineStage } from './diagnostics';
export type { DetectedBottleneck, BottleneckKind } from './bottleneckDetector';
export type { StoredSpan } from './spanStore';
