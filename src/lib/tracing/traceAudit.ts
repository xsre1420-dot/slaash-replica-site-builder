/**
 * Phase 1 — Distributed tracing audit registry (pre-modification baseline).
 */
export type TraceAuditCategory = 'traced' | 'partial' | 'broken' | 'missing';

export type TraceAuditEntry = {
  id: string;
  flow: string;
  boundary: string;
  category: TraceAuditCategory;
  description: string;
  remediation: string;
  resolved: boolean;
};

export const TRACE_AUDIT_REGISTRY: TraceAuditEntry[] = [
  { id: 'span.parent', flow: 'global', boundary: 'withSpan', category: 'missing', description: 'Spans lacked parentSpanId propagation', remediation: 'Active span stack in traceContext', resolved: true },
  { id: 'header.span', flow: 'global', boundary: 'rpc', category: 'missing', description: 'x-span-id not propagated on RPC', remediation: 'buildTraceHeaders in rpc.ts', resolved: true },
  { id: 'header.w3c', flow: 'global', boundary: 'rpc', category: 'missing', description: 'W3C traceparent header absent', remediation: 'traceparent header builder', resolved: true },
  { id: 'job.context', flow: 'background', boundary: 'JobQueue', category: 'broken', description: 'runWithJobContext did not restore trace stack', remediation: 'runWithTraceContext in jobs', resolved: true },
  { id: 'edge.span', flow: 'edge', boundary: 'withEdgeSpan', category: 'partial', description: 'Edge logs traceId but no spanId', remediation: 'spanId in edge observability', resolved: true },
  { id: 'storefront.load', flow: 'storefront.load', boundary: 'loadStorefrontBundle', category: 'missing', description: 'Storefront bundle load not traced end-to-end', remediation: 'traceCriticalFlow wrapper', resolved: true },
  { id: 'product.search', flow: 'product.search', boundary: 'fetchStorefrontProductsPage', category: 'missing', description: 'Product search not tagged as critical flow', remediation: 'traceCriticalFlow on search path', resolved: true },
  { id: 'checkout.submit', flow: 'checkout', boundary: 'useCheckoutFlow', category: 'partial', description: 'Checkout had metrics only, no span tree', remediation: 'traceCriticalFlow on submit', resolved: true },
  { id: 'order.create', flow: 'order.create', boundary: 'orderWriteService', category: 'partial', description: 'instrumentAsync without flow stage breakdown', remediation: 'FLOW_STAGE_MAP + span stages', resolved: true },
  { id: 'inventory.update', flow: 'inventory.update', boundary: 'inventoryWriteService', category: 'missing', description: 'Inventory mutations untraced', remediation: 'traceCriticalFlow on restock', resolved: true },
  { id: 'dashboard.load', flow: 'dashboard.load', boundary: 'dashboardStatsService', category: 'missing', description: 'Dashboard batch fetch untraced', remediation: 'traceCriticalFlow wrapper', resolved: true },
  { id: 'import.batch', flow: 'import', boundary: 'importJobService', category: 'partial', description: 'Import traced via generic instrumentAsync', remediation: 'FLOW_STAGE_MAP import.*', resolved: true },
  { id: 'analytics', flow: 'analytics', boundary: 'analyticsTrackingService', category: 'partial', description: 'Analytics fire-and-forget without span', remediation: 'traceCriticalFlow on track', resolved: true },
  { id: 'diagnostics', flow: 'global', boundary: 'platform', category: 'missing', description: 'No failed-request timeline API', remediation: 'getTraceDiagnostic()', resolved: true },
  { id: 'bottleneck', flow: 'global', boundary: 'platform', category: 'missing', description: 'No automatic bottleneck detection', remediation: 'detectBottlenecks()', resolved: true },
  { id: 'otel.export', flow: 'global', boundary: 'export', category: 'missing', description: 'Spans not exportable as OTEL traces', remediation: 'otelTraceExporter.ts', resolved: true },
  { id: 'span.store', flow: 'global', boundary: 'memory', category: 'missing', description: 'Spans only in reporter buffer', remediation: 'spanStore ring buffer by traceId', resolved: true },
  { id: 'payment', flow: 'payment', boundary: 'checkout', category: 'partial', description: 'Payment step inside checkout span only', remediation: 'checkout flow nested stages', resolved: true },
  { id: 'notification', flow: 'notification', boundary: 'background', category: 'partial', description: 'Notification jobs traced via job.start', remediation: 'JobQueue trace context', resolved: true },
  { id: 'cache.stage', flow: 'global', boundary: 'cache', category: 'missing', description: 'Cache hits not visible in span timeline', remediation: 'cache stage on enterprise cache (deferred)', resolved: false },
];

export function getTraceAuditSummary(): {
  total: number;
  traced: number;
  partial: number;
  missing: number;
  resolved: number;
  coverageBeforePct: number;
  coverageAfterPct: number;
} {
  const traced = TRACE_AUDIT_REGISTRY.filter((e) => e.category === 'traced').length;
  const partial = TRACE_AUDIT_REGISTRY.filter((e) => e.category === 'partial').length;
  const missing = TRACE_AUDIT_REGISTRY.filter((e) => e.category === 'missing').length;
  const resolved = TRACE_AUDIT_REGISTRY.filter((e) => e.resolved).length;
  const total = TRACE_AUDIT_REGISTRY.length;
  return {
    total,
    traced,
    partial,
    missing,
    resolved,
    coverageBeforePct: Math.round(((traced + partial * 0.5) / total) * 100),
    coverageAfterPct: Math.round((resolved / total) * 100),
  };
}
