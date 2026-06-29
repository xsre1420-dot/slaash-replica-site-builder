/**
 * Active distributed trace context — span stack for parent/child propagation.
 */
import { generateUUID } from '@/lib/uuid';
import { getCorrelationContext, newRequestId } from '@/lib/observability/correlation';

export type TraceStage =
  | 'frontend'
  | 'api'
  | 'rpc'
  | 'database'
  | 'edge'
  | 'cache'
  | 'background_worker'
  | 'external_api';

export type ActiveTraceContext = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  correlationId: string;
  requestId: string;
  flow?: string;
  stage?: TraceStage;
};

const generateSpanId = (): string => generateUUID().replace(/-/g, '').slice(0, 16);

const stack: ActiveTraceContext[] = [];

export function getActiveTraceContext(): ActiveTraceContext | null {
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

export function createTraceContext(overrides?: Partial<ActiveTraceContext>): ActiveTraceContext {
  const corr = getCorrelationContext();
  const parent = getActiveTraceContext();
  return {
    traceId: overrides?.traceId ?? corr.traceId,
    spanId: overrides?.spanId ?? generateSpanId(),
    parentSpanId: overrides?.parentSpanId ?? parent?.spanId,
    correlationId: overrides?.correlationId ?? corr.correlationId,
    requestId: overrides?.requestId ?? newRequestId(),
    flow: overrides?.flow,
    stage: overrides?.stage,
  };
}

export function pushTraceContext(ctx: ActiveTraceContext): void {
  stack.push(ctx);
}

export function popTraceContext(): ActiveTraceContext | undefined {
  return stack.pop();
}

export async function runWithTraceContext<T>(
  ctx: Partial<ActiveTraceContext>,
  fn: () => Promise<T>
): Promise<T> {
  const full = createTraceContext(ctx);
  pushTraceContext(full);
  try {
    return await fn();
  } finally {
    popTraceContext();
  }
}

export function runWithTraceContextSync<T>(ctx: Partial<ActiveTraceContext>, fn: () => T): T {
  const full = createTraceContext(ctx);
  pushTraceContext(full);
  try {
    return fn();
  } finally {
    popTraceContext();
  }
}

export function resetTraceContextForTests(): void {
  stack.length = 0;
}
