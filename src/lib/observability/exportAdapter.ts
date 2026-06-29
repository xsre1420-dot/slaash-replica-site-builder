/**
 * Vendor-neutral observability export — OpenTelemetry, Loki, Datadog, Elastic, Cloud Logging.
 */
import type { LogEvent, ObservabilityEvent } from './types';

export type ExportBackend =
  | 'opentelemetry'
  | 'loki'
  | 'datadog'
  | 'elastic'
  | 'cloud_logging'
  | 'webhook';

export type NormalizedLogRecord = {
  timestamp: string;
  severity: string;
  body: string;
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
  request_id?: string;
  session_id?: string;
  user_id?: string;
  merchant_id?: string;
  store_id?: string;
  environment?: string;
  attributes: Record<string, unknown>;
};

const levelToSeverity = (level: string): string => level.toUpperCase();

export function normalizeObservabilityEvent(
  event: ObservabilityEvent
): NormalizedLogRecord | null {
  if (event.type !== 'log') return null;

  const ctx = event.context ?? {};
  return {
    timestamp: event.timestamp,
    severity: levelToSeverity(event.level),
    body: event.message,
    trace_id: event.traceId ?? (ctx.traceId as string | undefined),
    span_id: event.spanId,
    correlation_id: (ctx.correlationId as string | undefined) ?? event.correlationId,
    request_id: (ctx.requestId as string | undefined) ?? event.requestId,
    session_id: event.sessionId,
    user_id: event.userId ?? (ctx.userId as string | undefined),
    merchant_id: (ctx.merchantId as string | undefined) ?? event.merchantId,
    store_id: (ctx.storeId as string | undefined) ?? event.storeId,
    environment: (ctx.environment as string | undefined) ?? event.environment,
    attributes: {
      level: event.level,
      route: event.route,
      rpcName: event.rpcName,
      edgeFunction: event.edgeFunction,
      durationMs: event.durationMs,
      status: event.status,
      errorCategory: event.errorCategory,
      errorCode: event.errorCode,
      ...ctx,
      error: event.error,
    },
  };
}

export function formatForBackend(
  events: ObservabilityEvent[],
  backend: ExportBackend
): unknown {
  const logs = events
    .map(normalizeObservabilityEvent)
    .filter((r): r is NormalizedLogRecord => r != null);

  switch (backend) {
    case 'opentelemetry':
      return {
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: logs.map((r) => ({
                  timeUnixNano: `${Date.parse(r.timestamp) * 1_000_000}`,
                  severityText: r.severity,
                  body: { stringValue: r.body },
                  traceId: r.trace_id,
                  spanId: r.span_id,
                  attributes: Object.entries(r.attributes).map(([k, v]) => ({
                    key: k,
                    value: { stringValue: String(v) },
                  })),
                })),
              },
            ],
          },
        ],
      };

    case 'loki':
      return {
        streams: [
          {
            stream: {
              job: 'slaash-platform',
              environment: logs[0]?.environment ?? 'unknown',
            },
            values: logs.map((r) => [
              `${Date.parse(r.timestamp) * 1_000_000}`,
              JSON.stringify({
                severity: r.severity,
                body: r.body,
                correlation_id: r.correlation_id,
                trace_id: r.trace_id,
                ...r.attributes,
              }),
            ]),
          },
        ],
      };

    case 'datadog':
      return logs.map((r) => ({
        ddsource: 'slaash-platform',
        ddtags: `env:${r.environment ?? 'unknown'},severity:${r.severity}`,
        message: r.body,
        correlation_id: r.correlation_id,
        trace_id: r.trace_id,
        ...r.attributes,
      }));

    case 'elastic':
    case 'cloud_logging':
    case 'webhook':
    default:
      return { records: logs };
  }
}
