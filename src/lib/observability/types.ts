export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface CorrelationContext {
  sessionId: string;
  traceId: string;
  correlationId: string;
  userId?: string;
  merchantId?: string;
  storeId?: string;
  route?: string;
  environment?: string;
}

export interface LogEvent {
  type: 'log';
  timestamp: string;
  level: LogLevel;
  severity: string;
  message: string;
  sessionId: string;
  traceId: string;
  correlationId?: string;
  requestId?: string;
  spanId?: string;
  route?: string;
  userId?: string;
  merchantId?: string;
  storeId?: string;
  environment?: string;
  rpcName?: string;
  edgeFunction?: string;
  durationMs?: number;
  status?: string;
  errorCategory?: string;
  errorCode?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface MetricEvent {
  type: 'metric';
  timestamp: string;
  name: string;
  value: number;
  unit: 'count' | 'ms' | 'bytes';
  sessionId: string;
  traceId: string;
  tags?: Record<string, string>;
}

export interface SpanEvent {
  type: 'span';
  timestamp: string;
  name: string;
  durationMs: number;
  status: 'ok' | 'error';
  sessionId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  attributes?: Record<string, unknown>;
  error?: string;
}

export interface AlertEvent {
  type: 'alert';
  timestamp: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  sessionId: string;
  traceId: string;
  context?: Record<string, unknown>;
}

export type ObservabilityEvent = LogEvent | MetricEvent | SpanEvent | AlertEvent;
