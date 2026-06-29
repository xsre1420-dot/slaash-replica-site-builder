/**
 * Critical business flows — end-to-end trace entry points.
 */
import type { TraceStage } from './traceContext';
import { traceSpan, type SpanHandle } from './spanEngine';

export type CriticalFlowName =
  | 'storefront.load'
  | 'product.search'
  | 'checkout'
  | 'order.create'
  | 'inventory.update'
  | 'payment'
  | 'notification'
  | 'import'
  | 'analytics'
  | 'dashboard.load';

export const CRITICAL_FLOWS: CriticalFlowName[] = [
  'storefront.load',
  'product.search',
  'checkout',
  'order.create',
  'inventory.update',
  'payment',
  'notification',
  'import',
  'analytics',
  'dashboard.load',
];

/** Map instrumentAsync operation names to flow + default stage. */
export const FLOW_STAGE_MAP: Record<string, { flow: CriticalFlowName; stage: TraceStage }> = {
  'order.create': { flow: 'order.create', stage: 'rpc' },
  'orders.fetchFiltered': { flow: 'dashboard.load', stage: 'database' },
  'orders.fetchPage': { flow: 'dashboard.load', stage: 'database' },
  'orders.statsSummary': { flow: 'dashboard.load', stage: 'database' },
  'import.enqueue': { flow: 'import', stage: 'api' },
  'import.processBatch': { flow: 'import', stage: 'background_worker' },
};

export async function traceCriticalFlow<T>(
  flow: CriticalFlowName,
  stage: TraceStage,
  operation: string,
  fn: (span: SpanHandle) => Promise<T>,
  attributes?: Record<string, unknown>
): Promise<T> {
  return traceSpan(`${flow}.${operation}`, fn, {
    ...attributes,
    flow,
    stage,
    criticalFlow: flow,
  });
}

export function resolveFlowStage(operation: string): { flow?: CriticalFlowName; stage?: TraceStage } {
  return FLOW_STAGE_MAP[operation] ?? {};
}
