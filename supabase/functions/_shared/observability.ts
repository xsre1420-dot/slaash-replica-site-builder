type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export const CORRELATION_HEADERS = {
  correlationId: 'x-correlation-id',
  requestId: 'x-request-id',
  traceId: 'x-trace-id',
  spanId: 'x-span-id',
  parentSpanId: 'x-parent-span-id',
  traceparent: 'traceparent',
} as const;

const SENSITIVE_KEY =
  /^(password|passwd|secret|token|apikey|api_key|authorization|bearer|cookie|session_token|access_token|refresh_token|credit_card|cvv|ssn|private_key|service_role|anon_key)$/i;

interface StructuredLog {
  level: LogLevel;
  severity: string;
  message: string;
  timestamp: string;
  environment?: string;
  function?: string;
  edgeFunction?: string;
  correlationId?: string;
  requestId?: string;
  traceId?: string;
  durationMs?: number;
  status?: string;
  errorCategory?: string;
  errorCode?: string;
  [key: string]: unknown;
}

function redactFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactFields(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function extractCorrelationFromRequest(req: Request): {
  correlationId?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  traceparent?: string;
} {
  const tp = req.headers.get(CORRELATION_HEADERS.traceparent);
  return {
    correlationId: req.headers.get(CORRELATION_HEADERS.correlationId) ?? undefined,
    requestId: req.headers.get(CORRELATION_HEADERS.requestId) ?? crypto.randomUUID(),
    traceId: req.headers.get(CORRELATION_HEADERS.traceId) ?? undefined,
    spanId: req.headers.get(CORRELATION_HEADERS.spanId) ?? undefined,
    parentSpanId: req.headers.get(CORRELATION_HEADERS.parentSpanId) ?? undefined,
    traceparent: tp ?? undefined,
  };
}

export const logStructured = (
  level: LogLevel,
  message: string,
  fields: Record<string, unknown> = {}
) => {
  const severity = level.toUpperCase();
  const entry: StructuredLog = {
    level,
    severity,
    message,
    timestamp: new Date().toISOString(),
    environment: Deno.env.get('ENVIRONMENT') ?? Deno.env.get('DENO_ENV') ?? 'edge',
    ...redactFields(fields),
  };

  const line = JSON.stringify(entry);
  switch (level) {
    case 'error':
    case 'fatal':
      console.error(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    case 'trace':
    case 'debug':
      console.debug(line);
      break;
    default:
      console.log(line);
  }
};

export const withEdgeSpan = async <T>(
  name: string,
  fn: () => Promise<T>,
  fields: Record<string, unknown> = {},
  req?: Request
): Promise<T> => {
  const correlation = req ? extractCorrelationFromRequest(req) : {};
  const requestId = correlation.requestId ?? crypto.randomUUID();
  const edgeSpanId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const started = performance.now();
  logStructured('debug', `${name}.start`, {
    ...fields,
    edgeFunction: name,
    requestId,
    correlationId: correlation.correlationId,
    traceId: correlation.traceId,
    spanId: edgeSpanId,
    parentSpanId: correlation.spanId ?? correlation.parentSpanId,
    traceparent: correlation.traceparent,
    stage: 'edge',
  });
  try {
    const result = await fn();
    logStructured('info', `${name}.ok`, {
      ...fields,
      edgeFunction: name,
      requestId,
      correlationId: correlation.correlationId,
      traceId: correlation.traceId,
      spanId: edgeSpanId,
      parentSpanId: correlation.spanId ?? correlation.parentSpanId,
      stage: 'edge',
      durationMs: Math.round(performance.now() - started),
      status: 'ok',
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStructured('error', `${name}.failed`, {
      ...fields,
      edgeFunction: name,
      requestId,
      correlationId: correlation.correlationId,
      traceId: correlation.traceId,
      durationMs: Math.round(performance.now() - started),
      status: 'error',
      errorCategory: /timeout|aborted/i.test(message)
        ? 'timeout'
        : /jwt|unauthorized|401/i.test(message)
          ? 'authentication'
          : /forbidden|permission|403/i.test(message)
            ? 'authorization'
            : 'unexpected',
      error: message,
    });
    throw error;
  }
};
