import { describe, it, expect, beforeEach } from 'vitest';
import {
  traceSpan,
  traceCriticalFlow,
  getTraceDiagnostic,
  getTraceDiagnosticByCorrelationId,
  detectBottlenecks,
  exportTracesOtel,
  buildTraceparent,
  buildTracePropagationHeaders,
  resetTracingForTests,
  CRITICAL_FLOWS,
} from '@/lib/tracing';
import { getTraceAuditSummary } from '@/lib/tracing/traceAudit';
import { resetCorrelationForTests } from '@/lib/observability/correlation';

describe('distributed tracing', () => {
  beforeEach(() => {
    resetTracingForTests();
    resetCorrelationForTests();
  });

  it('creates parent/child span chain', async () => {
    await traceSpan('parent', async () => {
      await traceSpan('child', async () => 'ok');
    });
    const traces = exportTracesOtel();
    expect(traces.resourceSpans[0].scopeSpans[0].spans.length).toBeGreaterThanOrEqual(2);
  });

  it('records critical flow attributes', async () => {
    await traceCriticalFlow('checkout', 'frontend', 'submit', async (span) => {
      span.setAttribute('ownerId', 'owner-1');
      return true;
    });
    const diagnostic = getTraceDiagnosticByCorrelationId(
      (await import('@/lib/observability/correlation')).getCorrelationContext().correlationId
    );
    expect(diagnostic?.timeline.some((t) => t.flow === 'checkout')).toBe(true);
  });

  it('builds W3C traceparent header', () => {
    const tp = buildTraceparent(
      'abcd1234abcd1234abcd1234abcd1234',
      'abcd1234abcd1234'
    );
    expect(tp).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it('propagation headers include traceparent', async () => {
    await traceSpan('rpc.test', async () => {
      const headers = buildTracePropagationHeaders();
      expect(headers.traceparent).toBeTruthy();
      expect(headers['x-span-id']).toBeTruthy();
    });
  });

  it('detects slow spans as bottlenecks', async () => {
    await traceSpan('slow.rpc', async () => {
      await new Promise((r) => setTimeout(r, 5));
    }, { stage: 'rpc' });
    const corr = (await import('@/lib/observability/correlation')).getCorrelationContext();
    const diag = getTraceDiagnosticByCorrelationId(corr.correlationId);
    expect(diag?.timeline.length).toBeGreaterThan(0);
  });

  it('diagnostic includes timeline and latency by stage', async () => {
    await traceCriticalFlow('dashboard.load', 'rpc', 'batch', async () => 'data');
    const corr = (await import('@/lib/observability/correlation')).getCorrelationContext();
    const diag = getTraceDiagnosticByCorrelationId(corr.correlationId);
    expect(diag?.timeline.length).toBeGreaterThan(0);
    expect(diag?.generatedAt).toBeTruthy();
  });

  it('covers all critical flows in registry', () => {
    expect(CRITICAL_FLOWS.length).toBeGreaterThanOrEqual(10);
    const summary = getTraceAuditSummary();
    expect(summary.resolved).toBeGreaterThan(0);
  });

  it('exports OTEL trace JSON', async () => {
    await traceSpan('test.export', async () => 'x');
    const otel = exportTracesOtel();
    expect(otel.resourceSpans).toHaveLength(1);
  });
});
