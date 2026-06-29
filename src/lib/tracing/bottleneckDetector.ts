/**
 * Phase 5 — Automatic bottleneck detection from span timelines.
 */
import { getSpansForTrace, type StoredSpan } from './spanStore';

export type BottleneckKind =
  | 'slow_rpc'
  | 'slow_database'
  | 'slow_edge'
  | 'slow_worker'
  | 'slow_cache'
  | 'slow_external'
  | 'network_latency'
  | 'repeated_retry';

export type DetectedBottleneck = {
  kind: BottleneckKind;
  spanName: string;
  spanId: string;
  durationMs: number;
  thresholdMs: number;
  stage?: string;
  message: string;
};

const THRESHOLDS_MS: Record<string, number> = {
  rpc: 1500,
  database: 2000,
  edge: 2000,
  background_worker: 5000,
  cache: 500,
  external_api: 3000,
  frontend: 3000,
  api: 2000,
};

function classifyKind(span: StoredSpan): BottleneckKind {
  const stage = span.stage ?? 'api';
  if (/retry|attempt/i.test(span.name)) return 'repeated_retry';
  if (stage === 'rpc') return 'slow_rpc';
  if (stage === 'database') return 'slow_database';
  if (stage === 'edge') return 'slow_edge';
  if (stage === 'background_worker') return 'slow_worker';
  if (stage === 'cache') return 'slow_cache';
  if (stage === 'external_api') return 'slow_external';
  if (/fetch|network|http/i.test(span.name)) return 'network_latency';
  return 'slow_rpc';
}

export function detectBottlenecks(spans: StoredSpan[]): DetectedBottleneck[] {
  const out: DetectedBottleneck[] = [];
  const retryCounts = new Map<string, number>();

  for (const span of spans) {
    const stage = span.stage ?? 'api';
    const threshold = THRESHOLDS_MS[stage] ?? 2000;

    if (span.durationMs >= threshold) {
      out.push({
        kind: classifyKind(span),
        spanName: span.name,
        spanId: span.spanId,
        durationMs: span.durationMs,
        thresholdMs: threshold,
        stage,
        message: `${span.name} took ${span.durationMs}ms (threshold ${threshold}ms)`,
      });
    }

    if (/retry|attempt/i.test(span.name)) {
      const key = span.flow ?? span.name;
      retryCounts.set(key, (retryCounts.get(key) ?? 0) + 1);
    }
  }

  for (const [key, count] of retryCounts) {
    if (count >= 2) {
      out.push({
        kind: 'repeated_retry',
        spanName: key,
        spanId: '',
        durationMs: 0,
        thresholdMs: 1,
        message: `${key} retried ${count} times`,
      });
    }
  }

  return out.sort((a, b) => b.durationMs - a.durationMs);
}

export function detectBottlenecksForTrace(traceId: string): DetectedBottleneck[] {
  return detectBottlenecks(getSpansForTrace(traceId));
}
