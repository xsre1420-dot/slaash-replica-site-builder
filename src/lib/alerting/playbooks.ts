/**
 * Phase 4 — Operational runbooks for every critical alert.
 */
export type IncidentPlaybook = {
  alertId: string;
  title: string;
  symptoms: string[];
  likelyCauses: string[];
  immediateActions: string[];
  verificationSteps: string[];
  recoveryProcedure: string[];
  escalationPath: string[];
};

export const INCIDENT_PLAYBOOKS: IncidentPlaybook[] = [
  {
    alertId: 'high-error-rate',
    title: 'High Error Rate',
    symptoms: ['RPC error rate > 5%', 'Elevated errors_by_category', 'Circuit breakers open'],
    likelyCauses: ['Database instability', 'Replica outage', 'Deployment regression', 'External API failure'],
    immediateActions: [
      'Check platform_health_check and circuit breaker status',
      'Review error taxonomy logs for dominant category',
      'Verify read replica routing and fallback counts',
    ],
    verificationSteps: [
      'rpc_errors_total rate below 2% for 5 minutes',
      'No open circuit breakers on critical RPCs',
      'Sample checkout and order RPC succeeds',
    ],
    recoveryProcedure: [
      'Failover to primary if replica issue',
      'Rollback recent deploy if regression suspected',
      'Scale connection pool if saturation related',
    ],
    escalationPath: ['On-call SRE', 'Platform lead if > 15 min', 'CTO if checkout impacted > 30 min'],
  },
  {
    alertId: 'checkout-failure',
    title: 'Checkout Failure Rate',
    symptoms: ['checkout_failed_total rising', 'checkout success rate < 90%', 'Merchant reports'],
    likelyCauses: ['Stock deduction RPC failure', 'Payment validation', 'Idempotency conflict', 'Coupon/pricing mismatch'],
    immediateActions: [
      'Inspect checkout.submit.failed structured logs',
      'Check create_order_with_stock_deduction RPC health',
      'Verify inventory levels for hot SKUs',
    ],
    verificationSteps: [
      'Test checkout on staging store',
      'checkout_success_rate > 95% for 10 minutes',
      'No order.create dead letters',
    ],
    recoveryProcedure: [
      'Force primary DB for checkout RPCs if replica lag',
      'Clear stuck idempotency keys if duplicate errors',
      'Disable problematic coupons if validation errors spike',
    ],
    escalationPath: ['Commerce on-call', 'SRE if DB-related', 'Product if business rule error'],
  },
  {
    alertId: 'database-saturation',
    title: 'Database Connection Saturation',
    symptoms: ['Pool utilization > 90%', 'Connection timeouts', 'Slow queries increasing'],
    likelyCauses: ['Connection leak', 'Traffic spike', 'Long transactions', 'Pool size too small'],
    immediateActions: [
      'Check db_connection_pool_utilization gauge',
      'Review active connections via platform_health_check',
      'Identify slow queries in db_slow_queries_total',
    ],
    verificationSteps: ['Pool utilization < 75%', 'RPC P95 normalized', 'No PGRST pool timeout errors'],
    recoveryProcedure: [
      'Increase pooler max connections if headroom available',
      'Kill long-running queries if identified',
      'Enable read replica routing for read-heavy RPCs',
    ],
    escalationPath: ['DBA on-call', 'SRE lead', 'Infrastructure if hardware limit'],
  },
  {
    alertId: 'pool-exhaustion',
    title: 'Connection Pool Exhaustion',
    symptoms: ['Pool at 95%+', 'New connections rejected', '503/timeout on RPCs'],
    likelyCauses: ['Sudden traffic burst', 'Connection leak in hot path', 'Worker stampede'],
    immediateActions: ['Enable circuit breaker throttling', 'Route reads to replica', 'Reduce background job concurrency'],
    verificationSteps: ['Pool drops below 80%', 'RPC success rate restored'],
    recoveryProcedure: ['Restart pooler if platform allows', 'Scale app instances horizontally', 'Fix leaking code path'],
    escalationPath: ['SRE immediate', 'DBA within 10 min'],
  },
  {
    alertId: 'queue-backlog',
    title: 'Queue Backlog',
    symptoms: ['background_queue_depth > 100', 'Jobs aging in pending', 'Processing rate drop'],
    likelyCauses: ['Worker crash', 'Slow downstream RPC', 'Poison message retry loop'],
    immediateActions: ['Check JobQueue metrics and worker heartbeat', 'Inspect dead letter queue', 'Review background.job.retry logs'],
    verificationSteps: ['Queue depth trending down', 'processingRatePerMin stable', 'No new dead letters'],
    recoveryProcedure: ['Scale worker concurrency if safe', 'Skip/repair poison jobs', 'Replay dead letter after fix'],
    escalationPath: ['Background jobs owner', 'SRE if infra'],
  },
  {
    alertId: 'worker-failures',
    title: 'Worker Dead Letter Spike',
    symptoms: ['background_dead_letter_total increasing', 'Failed job types clustered'],
    likelyCauses: ['External webhook down', 'Invalid payload', 'Permission/RLS change'],
    immediateActions: ['Identify job type from dead_letter logs', 'Check correlationId trace timeline', 'Pause enqueue for failing type if needed'],
    verificationSteps: ['Dead letter rate zero for 15 min', 'Sample job of each type succeeds'],
    recoveryProcedure: ['Fix root cause', 'Replay from dead letter with idempotency', 'Update retry policy if transient'],
    escalationPath: ['Service owner for job type', 'SRE'],
  },
  {
    alertId: 'edge-function-failures',
    title: 'Edge Function Failures',
    symptoms: ['edge_errors_total rising', 'Storefront bundle load failures', '502 from edge'],
    likelyCauses: ['Edge deploy error', 'Upstream RPC timeout', 'KV/cache unavailable'],
    immediateActions: ['Check edge function logs with traceId', 'Verify RPC fallback path', 'Test get-store-products edge'],
    verificationSteps: ['edge_invocations success rate > 98%', 'Storefront bundle loads in browser'],
    recoveryProcedure: ['Redeploy edge function', 'Increase edge timeout if RPC slow', 'Bypass edge cache temporarily'],
    escalationPath: ['Edge platform owner', 'SRE'],
  },
  {
    alertId: 'cache-failures',
    title: 'Cache Failures',
    symptoms: ['cache_failures_total spike', 'Hit rate drop', 'Latency increase'],
    likelyCauses: ['KV unavailable', 'Invalidation storm', 'Circuit open on cache layer'],
    immediateActions: ['Check cache health indicator', 'Verify enterprise cache circuit state', 'Monitor origin DB load'],
    verificationSteps: ['cache_hit_rate recovering', 'fetchFailures zero for 10 min'],
    recoveryProcedure: ['Fail open to origin', 'Warm critical caches', 'Fix KV connectivity'],
    escalationPath: ['Cache owner', 'SRE'],
  },
  {
    alertId: 'authentication-failures',
    title: 'Authentication Failures',
    symptoms: ['auth.login failure spike', 'JWT errors in logs', 'Merchant lockouts'],
    likelyCauses: ['Supabase auth outage', 'Clock skew', 'Brute force', 'Config regression'],
    immediateActions: ['Check auth session health indicator', 'Review auth.login health domain', 'Verify Supabase status page'],
    verificationSteps: ['Login success rate normal', 'No 401 spike on RPC'],
    recoveryProcedure: ['Rotate keys if compromise suspected', 'Adjust rate limits', 'Communicate if provider outage'],
    escalationPath: ['Auth owner', 'Security if attack suspected'],
  },
  {
    alertId: 'storage-failures',
    title: 'Storage Failures',
    symptoms: ['Upload failures', 'platform health storage check false', 'Media 5xx'],
    likelyCauses: ['Bucket policy', 'Quota exceeded', 'Network to object storage'],
    immediateActions: ['Run platform_health_check storage flag', 'Check storage RLS policies', 'Verify bucket connectivity'],
    verificationSteps: ['Test image upload on staging', 'storage health indicator green'],
    recoveryProcedure: ['Fix bucket permissions', 'Clear quota if full', 'Failover bucket if multi-region'],
    escalationPath: ['Media/storage owner', 'SRE'],
  },
];

export function getPlaybook(alertId: string): IncidentPlaybook | undefined {
  return INCIDENT_PLAYBOOKS.find((p) => p.alertId === alertId);
}

export function listPlaybooks(): Pick<IncidentPlaybook, 'alertId' | 'title'>[] {
  return INCIDENT_PLAYBOOKS.map(({ alertId, title }) => ({ alertId, title }));
}
