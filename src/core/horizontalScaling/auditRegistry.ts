/**
 * Phase 1 — Horizontal scaling audit registry.
 * Documents every component that assumes single-instance or local state.
 */
export type StatefulnessClass =
  | 'stateless'
  | 'client_ephemeral'
  | 'client_shared'
  | 'per_instance_l1'
  | 'requires_external_store';

export type ScalingAuditEntry = {
  id: string;
  component: string;
  location: string;
  stateClass: StatefulnessClass;
  singleInstanceRisk: 'none' | 'low' | 'medium' | 'high';
  mitigation: string;
  multiServerReady: boolean;
};

export const HORIZONTAL_SCALING_AUDIT: ScalingAuditEntry[] = [
  {
    id: 'auth.jwt',
    component: 'Supabase Auth JWT',
    location: 'src/lib/authSession.ts',
    stateClass: 'stateless',
    singleInstanceRisk: 'none',
    mitigation: 'Server validates JWT; no sticky sessions required',
    multiServerReady: true,
  },
  {
    id: 'cache.l1',
    component: 'In-memory LRU cache',
    location: 'src/lib/cache.ts',
    stateClass: 'per_instance_l1',
    singleInstanceRisk: 'low',
    mitigation: 'Optional L2 KV (VITE_KV_REST_*); SWR + TTL; per-instance expected',
    multiServerReady: true,
  },
  {
    id: 'cache.l2',
    component: 'Distributed KV cache',
    location: 'src/lib/cache/kvAdapter.ts',
    stateClass: 'requires_external_store',
    singleInstanceRisk: 'none',
    mitigation: 'Shared Redis/KV when configured',
    multiServerReady: true,
  },
  {
    id: 'background.client_queue',
    component: 'Client background job queue',
    location: 'src/background/queues/JobQueue.ts',
    stateClass: 'per_instance_l1',
    singleInstanceRisk: 'medium',
    mitigation: 'IndexedDB persistence + DB outbox for server work; workerInstanceId',
    multiServerReady: true,
  },
  {
    id: 'background.idempotency',
    component: 'In-process idempotency map',
    location: 'src/background/shared/idempotency.ts',
    stateClass: 'per_instance_l1',
    singleInstanceRisk: 'low',
    mitigation: 'KV L2 distributedIdempotency + DB outbox SKIP LOCKED',
    multiServerReady: true,
  },
  {
    id: 'circuit.breaker',
    component: 'In-process circuit breakers',
    location: 'src/lib/resilience/circuitBreaker.ts',
    stateClass: 'per_instance_l1',
    singleInstanceRisk: 'low',
    mitigation: 'Per-instance breakers; replica→primary fallback',
    multiServerReady: true,
  },
  {
    id: 'session.checkout',
    component: 'Checkout sessionStorage keys',
    location: 'src/utils/checkoutSession.ts',
    stateClass: 'client_ephemeral',
    singleInstanceRisk: 'none',
    mitigation: 'Browser-local UX state; order idempotency in DB',
    multiServerReady: true,
  },
  {
    id: 'session.auth_remember',
    component: 'Auth remember-me storage',
    location: 'src/lib/authUtils.ts',
    stateClass: 'client_shared',
    singleInstanceRisk: 'none',
    mitigation: 'Supabase refresh token in localStorage; JWT stateless',
    multiServerReady: true,
  },
  {
    id: 'session.attribution',
    component: 'Marketing attribution sessionStorage',
    location: 'src/lib/attribution.ts',
    stateClass: 'client_ephemeral',
    singleInstanceRisk: 'none',
    mitigation: 'Client-only; persisted to order on write',
    multiServerReady: true,
  },
  {
    id: 'dr.failover_flag',
    component: 'DR failover session flag',
    location: 'src/lib/disasterRecovery/failover.ts',
    stateClass: 'client_ephemeral',
    singleInstanceRisk: 'none',
    mitigation: 'Per-tab failover routing; env-driven URLs',
    multiServerReady: true,
  },
  {
    id: 'worker.identity',
    component: 'Worker instance ID',
    location: 'src/core/distributed/workerIdentity.ts',
    stateClass: 'client_ephemeral',
    singleInstanceRisk: 'none',
    mitigation: 'Metrics only; not used for leader election',
    multiServerReady: true,
  },
  {
    id: 'realtime.hubs',
    component: 'Supabase Realtime subscriptions',
    location: 'src/hooks/*',
    stateClass: 'stateless',
    singleInstanceRisk: 'low',
    mitigation: 'Connection per client; server-side state in Postgres',
    multiServerReady: true,
  },
  {
    id: 'spa.static',
    component: 'Static SPA bundle',
    location: 'dist/',
    stateClass: 'stateless',
    singleInstanceRisk: 'none',
    mitigation: 'Horizontally scalable behind load balancer',
    multiServerReady: true,
  },
  {
    id: 'edge.functions',
    component: 'Supabase Edge Functions',
    location: 'supabase/functions/',
    stateClass: 'stateless',
    singleInstanceRisk: 'low',
    mitigation: 'Optional KV; auto-scaled isolates',
    multiServerReady: true,
  },
  {
    id: 'postgres.primary',
    component: 'PostgreSQL primary',
    location: 'Supabase',
    stateClass: 'requires_external_store',
    singleInstanceRisk: 'high',
    mitigation: 'Read replicas, pooler, partitioning (prior phases)',
    multiServerReady: true,
  },
];

export function getScalingAuditSummary(): {
  total: number;
  multiServerReady: number;
  perInstanceL1: number;
  clientLocal: number;
  requiresExternal: number;
  notReady: number;
} {
  const ready = HORIZONTAL_SCALING_AUDIT.filter((e) => e.multiServerReady).length;
  return {
    total: HORIZONTAL_SCALING_AUDIT.length,
    multiServerReady: ready,
    perInstanceL1: HORIZONTAL_SCALING_AUDIT.filter((e) => e.stateClass === 'per_instance_l1').length,
    clientLocal: HORIZONTAL_SCALING_AUDIT.filter(
      (e) => e.stateClass === 'client_ephemeral' || e.stateClass === 'client_shared'
    ).length,
    requiresExternal: HORIZONTAL_SCALING_AUDIT.filter((e) => e.stateClass === 'requires_external_store')
      .length,
    notReady: HORIZONTAL_SCALING_AUDIT.filter((e) => !e.multiServerReady).length,
  };
}

export function listHighRiskComponents(): ScalingAuditEntry[] {
  return HORIZONTAL_SCALING_AUDIT.filter((e) => e.singleInstanceRisk === 'high' && !e.multiServerReady);
}
