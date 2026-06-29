/**
 * Phase 7 — Production diagnostics: full request timeline from stored spans.
 */
import { getSpansForTrace, findTraceByCorrelationId, type StoredSpan } from './spanStore';
import { detectBottlenecks, type DetectedBottleneck } from './bottleneckDetector';
import { getTraceAuditSummary } from './traceAudit';

export type TraceTimelineStage = {
  spanId: string;
  parentSpanId?: string;
  name: string;
  flow?: string;
  stage?: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  status: 'ok' | 'error';
  error?: string;
  attributes: Record<string, unknown>;
};

export type TraceDiagnostic = {
  traceId: string;
  correlationId?: string;
  requestId?: string;
  status: 'ok' | 'error' | 'partial';
  totalDurationMs: number;
  timeline: TraceTimelineStage[];
  errors: Array<{ spanId: string; name: string; message: string }>;
  latencyByStage: Record<string, number>;
  dependencies: string[];
  bottlenecks: DetectedBottleneck[];
  generatedAt: string;
};

function buildTimeline(spans: StoredSpan[]): TraceTimelineStage[] {
  return [...spans]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => ({
      spanId: s.spanId,
      parentSpanId: s.parentSpanId,
      name: s.name,
      flow: s.flow,
      stage: s.stage,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      durationMs: s.durationMs,
      status: s.status,
      error: s.error,
      attributes: s.attributes,
    }));
}

function latencyByStage(spans: StoredSpan[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const s of spans) {
    const key = s.stage ?? 'unknown';
    acc[key] = (acc[key] ?? 0) + s.durationMs;
  }
  return acc;
}

function extractDependencies(spans: StoredSpan[]): string[] {
  const deps = new Set<string>();
  for (const s of spans) {
    if (s.stage === 'rpc' && s.attributes.rpcName) deps.add(String(s.attributes.rpcName));
    if (s.stage === 'edge' && s.attributes.edgeFunction) deps.add(String(s.attributes.edgeFunction));
    if (s.name.startsWith('rpc.')) deps.add(s.name);
  }
  return [...deps];
}

export function getTraceDiagnostic(traceId: string): TraceDiagnostic | null {
  const spans = getSpansForTrace(traceId);
  if (spans.length === 0) return null;

  const timeline = buildTimeline(spans);
  const errors = spans
    .filter((s) => s.status === 'error')
    .map((s) => ({ spanId: s.spanId, name: s.name, message: s.error ?? 'unknown' }));

  const minStart = Math.min(...spans.map((s) => s.startedAt));
  const maxEnd = Math.max(...spans.map((s) => s.endedAt));
  const root = spans.find((s) => !s.parentSpanId) ?? spans[0];

  return {
    traceId,
    correlationId: root.correlationId,
    requestId: root.requestId,
    status: errors.length > 0 ? 'error' : 'ok',
    totalDurationMs: maxEnd - minStart,
    timeline,
    errors,
    latencyByStage: latencyByStage(spans),
    dependencies: extractDependencies(spans),
    bottlenecks: detectBottlenecks(spans),
    generatedAt: new Date().toISOString(),
  };
}

export function getTraceDiagnosticByCorrelationId(correlationId: string): TraceDiagnostic | null {
  const traceId = findTraceByCorrelationId(correlationId);
  if (!traceId) return null;
  return getTraceDiagnostic(traceId);
}

export function getTracingStatus() {
  return {
    audit: getTraceAuditSummary(),
    exportBackends: ['opentelemetry', 'jaeger', 'tempo', 'datadog', 'newrelic', 'elastic'],
  };
}
