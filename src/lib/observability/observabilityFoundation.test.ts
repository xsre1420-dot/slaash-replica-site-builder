import { describe, it, expect, beforeEach } from 'vitest';
import {
  sanitizeLogContext,
  sanitizeErrorMessage,
} from '@/lib/observability/sanitizer';
import {
  classifyError,
  ERROR_CATEGORY_LABELS,
} from '@/lib/observability/errorTaxonomy';
import {
  buildCorrelationHeaders,
  getCorrelationContext,
  resetCorrelationForTests,
  CORRELATION_HEADERS,
} from '@/lib/observability/correlation';
import {
  normalizeObservabilityEvent,
  formatForBackend,
} from '@/lib/observability/exportAdapter';
import { getLoggingAuditSummary } from '@/lib/observability/loggingAudit';
import type { LogEvent } from '@/lib/observability/types';

describe('observability foundation', () => {
  beforeEach(() => {
    resetCorrelationForTests();
  });

  it('redacts sensitive fields', () => {
    const out = sanitizeLogContext({
      password: 'secret123',
      email: 'merchant@example.com',
      safe: 'visible',
    });
    expect(out?.password).toBe('[REDACTED]');
    expect(String(out?.email)).toContain('***');
    expect(out?.safe).toBe('visible');
  });

  it('redacts bearer tokens in error messages', () => {
    const msg = sanitizeErrorMessage('Auth failed Bearer eyJhbGciOiJIUzI1NiJ9.abc.def');
    expect(msg).not.toContain('eyJ');
    expect(msg).toContain('[REDACTED]');
  });

  it('classifies database errors', () => {
    const c = classifyError('PGRST connection pool timeout', { domain: 'order', code: 'PGRST001' });
    expect(['database', 'timeout']).toContain(c.category);
    expect(c.code).toBe('PGRST001');
  });

  it('covers all error taxonomy labels', () => {
    expect(Object.keys(ERROR_CATEGORY_LABELS).length).toBeGreaterThanOrEqual(11);
  });

  it('builds correlation headers', () => {
    const headers = buildCorrelationHeaders('req-123');
    expect(headers[CORRELATION_HEADERS.requestId]).toBe('req-123');
    expect(headers[CORRELATION_HEADERS.correlationId]).toBeTruthy();
    expect(headers[CORRELATION_HEADERS.traceId]).toBeTruthy();
  });

  it('getCorrelationContext includes correlationId', () => {
    const ctx = getCorrelationContext();
    expect(ctx.correlationId).toBeTruthy();
    expect(ctx.sessionId).toBeTruthy();
    expect(ctx.traceId).toBeTruthy();
  });

  it('normalizes log events for export', () => {
    const event: LogEvent = {
      type: 'log',
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'test.event',
      sessionId: 'sess-1',
      traceId: 'trace-1',
      context: { correlationId: 'corr-1', requestId: 'req-1', environment: 'test' },
    };
    const normalized = normalizeObservabilityEvent(event);
    expect(normalized?.severity).toBe('INFO');
    expect(normalized?.correlation_id).toBe('corr-1');
    expect(normalized?.body).toBe('test.event');
  });

  it('formats for loki backend', () => {
    const event: LogEvent = {
      type: 'log',
      timestamp: new Date().toISOString(),
      level: 'warn',
      message: 'warn.event',
      sessionId: 's',
      traceId: 't',
    };
    const formatted = formatForBackend([event], 'loki') as { streams: unknown[] };
    expect(formatted.streams).toHaveLength(1);
  });

  it('logging audit registry has entries', () => {
    const summary = getLoggingAuditSummary();
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.resolved).toBeGreaterThan(0);
  });
});
