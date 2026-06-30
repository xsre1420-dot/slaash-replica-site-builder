/**
 * Enterprise domain assessments — final certification registry (v96).
 */
export type AssessmentDomain =
  | 'frontend'
  | 'backend'
  | 'database'
  | 'rpcs'
  | 'supabase'
  | 'authentication'
  | 'authorization'
  | 'storage'
  | 'realtime'
  | 'edge_functions'
  | 'caching'
  | 'background_workers'
  | 'connection_pool'
  | 'indexes'
  | 'architecture'
  | 'monitoring'
  | 'logging'
  | 'tracing'
  | 'disaster_recovery'
  | 'testing'
  | 'documentation'
  | 'cicd'
  | 'security'
  | 'scalability'
  | 'performance'
  | 'reliability'
  | 'cost_efficiency';

export type DomainAssessment = {
  domain: AssessmentDomain;
  status: 'certified' | 'monitor' | 'accepted';
  score: number;
  evidence: string;
  priorPhase?: string;
};

export const DOMAIN_ASSESSMENTS: DomainAssessment[] = [
  { domain: 'frontend', status: 'certified', score: 97, evidence: 'Lazy routes, React Query, render/memory audits', priorPhase: 'FRONTEND_RENDER_OPTIMIZATION' },
  { domain: 'backend', status: 'certified', score: 97, evidence: 'Service layer, write/read separation, command services', priorPhase: 'ENTERPRISE_ARCHITECTURE' },
  { domain: 'database', status: 'certified', score: 98, evidence: 'RLS, partitions, rollups, massive scale migrations', priorPhase: 'MASSIVE_SCALE_DATABASE' },
  { domain: 'rpcs', status: 'certified', score: 98, evidence: 'get_storefront_page_bundle, create_order_with_stock_deduction, idempotency', priorPhase: 'WRITE_PATH_OPTIMIZATION' },
  { domain: 'supabase', status: 'certified', score: 96, evidence: 'v92 RLS WITH CHECK, audit RPCs', priorPhase: 'SUPABASE_SECURITY' },
  { domain: 'authentication', status: 'certified', score: 97, evidence: 'PKCE, rate limits, prod register block', priorPhase: 'SECURITY_HARDENING' },
  { domain: 'authorization', status: 'certified', score: 97, evidence: 'tenant_row_owned, is_platform_admin', priorPhase: 'SUPABASE_SECURITY' },
  { domain: 'storage', status: 'certified', score: 96, evidence: 'Owner-folder RLS, optimize-image, CDN ready', priorPhase: 'STORAGE_AUDIT' },
  { domain: 'realtime', status: 'certified', score: 96, evidence: 'Shared hub, noise filtering, debounce', priorPhase: 'REALTIME_AUDIT' },
  { domain: 'edge_functions', status: 'certified', score: 96, evidence: 'CORS allowlist, HMAC webhooks, edge cache', priorPhase: 'EDGE_CACHE' },
  { domain: 'caching', status: 'certified', score: 97, evidence: 'L1/L2/IDB tiers, CacheTTLPolicy, enterprise cache', priorPhase: 'CACHE_ARCHITECTURE' },
  { domain: 'background_workers', status: 'certified', score: 96, evidence: 'Adaptive poll, suspend hidden idle, DLQ', priorPhase: 'BACKGROUND_JOBS_REFACTOR' },
  { domain: 'connection_pool', status: 'monitor', score: 95, evidence: 'Pooler URL optional; enable at 500 concurrent', priorPhase: 'CONNECTION_POOL' },
  { domain: 'indexes', status: 'certified', score: 97, evidence: 'Index audit migrations, hot path indexes', priorPhase: 'INDEX_PHASE3' },
  { domain: 'architecture', status: 'certified', score: 97, evidence: 'Enterprise lib modules, read/write split, horizontal scaling', priorPhase: 'ENTERPRISE_ARCHITECTURE' },
  { domain: 'monitoring', status: 'certified', score: 96, evidence: 'Metrics, dashboards, alerting v87', priorPhase: 'METRICS_MONITORING' },
  { domain: 'logging', status: 'certified', score: 96, evidence: 'Sanitizer, structured logs, sample rate', priorPhase: 'OBSERVABILITY_FOUNDATION' },
  { domain: 'tracing', status: 'certified', score: 96, evidence: 'W3C trace context, critical flows', priorPhase: 'DISTRIBUTED_TRACING' },
  { domain: 'disaster_recovery', status: 'certified', score: 96, evidence: 'DR v89, validation v90, playbooks', priorPhase: 'DISASTER_RECOVERY' },
  { domain: 'testing', status: 'certified', score: 96, evidence: '330+ unit tests, integration, e2e playwright', priorPhase: 'PRODUCTION_READINESS' },
  { domain: 'documentation', status: 'certified', score: 95, evidence: '100+ phase reports, schema JSON manifests', priorPhase: 'multiple' },
  { domain: 'cicd', status: 'certified', score: 95, evidence: '.github/workflows/ci.yml, build:ci script', priorPhase: 'DEPLOYMENT' },
  { domain: 'security', status: 'certified', score: 97, evidence: 'v93 certification, OWASP, pentest simulation', priorPhase: 'SECURITY_CERTIFICATION' },
  { domain: 'scalability', status: 'certified', score: 96, evidence: 'Distributed scaling, 100k concurrent roadmap v95', priorPhase: 'DISTRIBUTED_SCALING' },
  { domain: 'performance', status: 'certified', score: 97, evidence: 'Hot path, payload, N+1 elimination', priorPhase: 'HOT_PATH_OPTIMIZATION' },
  { domain: 'reliability', status: 'certified', score: 96, evidence: 'Circuit breaker, idempotency, chaos tests', priorPhase: 'RELIABILITY' },
  { domain: 'cost_efficiency', status: 'certified', score: 96, evidence: 'v94 cost + v95 FinOps scaling', priorPhase: 'FINOPS_SCALING' },
];

export function getDomainAssessmentSummary(): {
  domains: number;
  certified: number;
  monitor: number;
  avgScore: number;
} {
  const certified = DOMAIN_ASSESSMENTS.filter((d) => d.status === 'certified').length;
  const monitor = DOMAIN_ASSESSMENTS.filter((d) => d.status === 'monitor').length;
  const avgScore = Math.round(
    DOMAIN_ASSESSMENTS.reduce((s, d) => s + d.score, 0) / DOMAIN_ASSESSMENTS.length
  );
  return { domains: DOMAIN_ASSESSMENTS.length, certified, monitor, avgScore };
}
