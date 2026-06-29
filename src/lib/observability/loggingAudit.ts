/**
 * Phase 1 — Logging audit registry (pre-modification baseline + targets).
 */
export type LogAuditCategory =
  | 'structured'
  | 'unstructured'
  | 'duplicate'
  | 'missing'
  | 'sensitive_risk'
  | 'low_value';

export type LoggingAuditEntry = {
  id: string;
  location: string;
  category: LogAuditCategory;
  description: string;
  remediation: string;
  resolved: boolean;
};

export const LOGGING_AUDIT_REGISTRY: LoggingAuditEntry[] = [
  {
    id: 'obs.logger.structured',
    location: 'src/lib/observability/logger.ts',
    category: 'structured',
    description: 'Central structured logger with reporter batch',
    remediation: 'Extend with trace/fatal, redaction, full context',
    resolved: true,
  },
  {
    id: 'obs.edge.structured',
    location: 'supabase/functions/_shared/observability.ts',
    category: 'structured',
    description: 'Edge JSON structured logs with correlation headers',
    remediation: 'Align client headers with edge CORRELATION_HEADERS',
    resolved: true,
  },
  {
    id: 'rpc.instrumentation',
    location: 'src/integrations/supabase/rpc.ts',
    category: 'missing',
    description: 'RPC calls lacked correlation header propagation',
    remediation: 'Add x-correlation-id, x-request-id, x-trace-id + duration logs',
    resolved: true,
  },
  {
    id: 'background.job.context',
    location: 'src/background/queues/JobQueue.ts',
    category: 'missing',
    description: 'Background jobs lacked job-scoped correlation',
    remediation: 'runWithJobContext wrapper',
    resolved: true,
  },
  {
    id: 'storefront.console',
    location: 'src/services/storefrontProductService.ts',
    category: 'unstructured',
    description: 'console.warn/error for storefront fallbacks',
    remediation: 'Route through logger.warn with rpc context (optional migration)',
    resolved: false,
  },
  {
    id: 'auth.console',
    location: 'src/lib/authUtils.ts',
    category: 'unstructured',
    description: 'console.error for auth operations',
    remediation: 'Use logger.error with errorCategory auth',
    resolved: true,
  },
  {
    id: 'reviews.console',
    location: 'src/services/reviewService.ts',
    category: 'unstructured',
    description: 'console.warn for review fetch failures',
    remediation: 'Use logger.warn with domain context',
    resolved: false,
  },
  {
    id: 'indexeddb.console',
    location: 'src/utils/indexedDB.ts',
    category: 'unstructured',
    description: 'console.warn for IDB failures',
    remediation: 'Use logger.warn cache category',
    resolved: false,
  },
  {
    id: 'checkout.high_value',
    location: 'src/services/write/orders/orderWriteService.ts',
    category: 'structured',
    description: 'Order create/update structured logs',
    remediation: 'Already instrumented — extend with error taxonomy',
    resolved: true,
  },
  {
    id: 'sensitive.tokens',
    location: 'global',
    category: 'sensitive_risk',
    description: 'Potential token/password in ad-hoc logs',
    remediation: 'sanitizeLogFields on all structured logs',
    resolved: true,
  },
  {
    id: 'duplicate.slow_query',
    location: 'src/lib/observability/instrument.ts',
    category: 'duplicate',
    description: 'Slow query logged in instrumentQuery + healthMonitor',
    remediation: 'Single path via instrumentQuery only',
    resolved: true,
  },
  {
    id: 'missing.rpc_success',
    location: 'src/integrations/supabase/rpc.ts',
    category: 'missing',
    description: 'RPC duration not logged on success path',
    remediation: 'instrumentRpc debug spans',
    resolved: true,
  },
];

export function getLoggingAuditSummary(): {
  total: number;
  structured: number;
  unstructured: number;
  missing: number;
  resolved: number;
  unresolved: number;
  coverageBeforePct: number;
  coverageAfterPct: number;
} {
  const structured = LOGGING_AUDIT_REGISTRY.filter((e) => e.category === 'structured').length;
  const unstructured = LOGGING_AUDIT_REGISTRY.filter((e) => e.category === 'unstructured').length;
  const missing = LOGGING_AUDIT_REGISTRY.filter((e) => e.category === 'missing').length;
  const resolved = LOGGING_AUDIT_REGISTRY.filter((e) => e.resolved).length;
  const total = LOGGING_AUDIT_REGISTRY.length;
  const beforeResolved = LOGGING_AUDIT_REGISTRY.filter(
    (e) => e.resolved && !['rpc.instrumentation', 'background.job.context', 'missing.rpc_success'].includes(e.id)
  ).length;
  return {
    total,
    structured,
    unstructured,
    missing,
    resolved,
    unresolved: total - resolved,
    coverageBeforePct: Math.round((beforeResolved / total) * 100),
    coverageAfterPct: Math.round((resolved / total) * 100),
  };
}
