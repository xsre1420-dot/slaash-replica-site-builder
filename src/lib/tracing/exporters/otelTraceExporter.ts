/**
 * OpenTelemetry trace JSON — Jaeger, Tempo, Datadog, New Relic, Elastic compatible.
 */
import type { StoredSpan } from '../spanStore';

export function formatOtelTraces(spans: StoredSpan[]): {
  resourceSpans: Array<{
    resource: { attributes: Array<{ key: string; value: { stringValue: string } }> };
    scopeSpans: Array<{
      spans: Array<{
        traceId: string;
        spanId: string;
        parentSpanId?: string;
        name: string;
        kind: number;
        startTimeUnixNano: string;
        endTimeUnixNano: string;
        status: { code: number; message?: string };
        attributes: Array<{ key: string; value: { stringValue: string } }>;
      }>;
    }>;
  }>;
} {
  const otelSpans = spans.map((s) => ({
    traceId: s.traceId.replace(/-/g, ''),
    spanId: s.spanId.replace(/-/g, '').slice(0, 16),
    parentSpanId: s.parentSpanId?.replace(/-/g, '').slice(0, 16),
    name: s.name,
    kind: spanKind(s.stage),
    startTimeUnixNano: `${s.startedAt * 1_000_000}`,
    endTimeUnixNano: `${s.endedAt * 1_000_000}`,
    status: {
      code: s.status === 'ok' ? 1 : 2,
      message: s.error,
    },
    attributes: Object.entries({
      flow: s.flow,
      stage: s.stage,
      correlation_id: s.correlationId,
      request_id: s.requestId,
      ...flattenAttributes(s.attributes),
    })
      .filter(([, v]) => v != null && v !== '')
      .map(([key, value]) => ({
        key,
        value: { stringValue: String(value) },
      })),
  }));

  return {
    resourceSpans: [
      {
        resource: {
          attributes: [{ key: 'service.name', value: { stringValue: 'slaash-platform' } }],
        },
        scopeSpans: [{ spans: otelSpans }],
      },
    ],
  };
}

function spanKind(stage?: string): number {
  switch (stage) {
    case 'frontend':
      return 1; // INTERNAL
    case 'rpc':
    case 'database':
      return 3; // CLIENT
    case 'edge':
    case 'background_worker':
      return 4; // PRODUCER
    case 'external_api':
      return 2; // SERVER
    default:
      return 1;
  }
}

function flattenAttributes(attrs: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null && typeof v !== 'object') out[k] = String(v);
  }
  return out;
}

/** Jaeger JSON format (subset). */
export function formatJaegerTraces(spans: StoredSpan[]): {
  data: Array<{
    traceID: string;
    spans: Array<{
      traceID: string;
      spanID: string;
      operationName: string;
      references: Array<{ refType: string; traceID: string; spanID: string }>;
      startTime: number;
      duration: number;
      tags: Array<{ key: string; value: string | number | boolean }>;
    }>;
  }>;
} {
  const byTrace = new Map<string, StoredSpan[]>();
  for (const s of spans) {
    const list = byTrace.get(s.traceId) ?? [];
    list.push(s);
    byTrace.set(s.traceId, list);
  }

  const data = [...byTrace.entries()].map(([traceID, traceSpans]) => ({
    traceID: traceID.replace(/-/g, ''),
    spans: traceSpans.map((s) => ({
      traceID: traceID.replace(/-/g, ''),
      spanID: s.spanId.replace(/-/g, '').slice(0, 16),
      operationName: s.name,
      references: s.parentSpanId
        ? [
            {
              refType: 'CHILD_OF',
              traceID: traceID.replace(/-/g, ''),
              spanID: s.parentSpanId.replace(/-/g, '').slice(0, 16),
            },
          ]
        : [],
      startTime: s.startedAt * 1000,
      duration: s.durationMs * 1000,
      tags: [
        { key: 'flow', value: s.flow ?? '' },
        { key: 'stage', value: s.stage ?? '' },
        { key: 'correlation_id', value: s.correlationId },
        { key: 'error', value: s.status === 'error' },
      ],
    })),
  }));

  return { data };
}
