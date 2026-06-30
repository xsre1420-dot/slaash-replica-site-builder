/**
 * Phase 5 — Failover readiness (future-ready architecture documentation).
 */
import { env } from '@/lib/env';
import { hasReadReplica } from './readRouting';

export type FailoverCapability = {
  id: string;
  capability: string;
  status: 'ready' | 'partial' | 'planned';
  notes: string;
};

export const FAILOVER_CAPABILITIES: FailoverCapability[] = [
  {
    id: 'client-endpoint-failover',
    capability: 'Client Supabase endpoint failover',
    status: 'ready',
    notes: 'activateFailover() + VITE_FAILOVER_SUPABASE_URL; session flag per tab',
  },
  {
    id: 'read-replica-routing',
    capability: 'Read replica read routing',
    status: 'ready',
    notes: 'READ_REPLICA_RPCS + resolveRpcEndpoint; no promotion automation',
  },
  {
    id: 'read-replica-promotion',
    capability: 'Read replica promotion to primary',
    status: 'planned',
    notes: 'Manual via Supabase dashboard; document promotion runbook for ops',
  },
  {
    id: 'database-failover',
    capability: 'Database failover to secondary project',
    status: 'partial',
    notes: 'Requires pre-provisioned secondary + restore from PITR/backup + DNS/env swap',
  },
  {
    id: 'regional-failover',
    capability: 'Regional outage failover',
    status: 'planned',
    notes: 'Cross-region secondary project + storage replication + global DNS',
  },
  {
    id: 'infrastructure-replacement',
    capability: 'Infrastructure replacement',
    status: 'partial',
    notes: 'Git-backed IaC; redeploy from tag; edge functions via supabase CLI',
  },
];

export type ServiceRecoveryStep = {
  order: number;
  service: string;
  action: string;
  owner: string;
  maxMinutes: number;
};

/** Ordered recovery sequence for catastrophic failure. */
export const SERVICE_RECOVERY_SEQUENCE: ServiceRecoveryStep[] = [
  { order: 1, service: 'secrets', action: 'Restore/rotate secrets from vault', owner: 'Security/Ops', maxMinutes: 20 },
  { order: 2, service: 'database', action: 'PITR or full restore to recovery project', owner: 'DBA', maxMinutes: 60 },
  { order: 3, service: 'rpc_layer', action: 'Verify PostgREST/pooler health on recovered DB', owner: 'SRE', maxMinutes: 10 },
  { order: 4, service: 'auth', action: 'Confirm Supabase Auth connected to recovered DB', owner: 'SRE', maxMinutes: 10 },
  { order: 5, service: 'object_storage', action: 'Restore/replicate storage buckets', owner: 'Ops', maxMinutes: 120 },
  { order: 6, service: 'edge_functions', action: 'Redeploy all edge functions with secrets', owner: 'Platform', maxMinutes: 30 },
  { order: 7, service: 'cache', action: 'Warm enterprise cache; fail open to origin', owner: 'SRE', maxMinutes: 15 },
  { order: 8, service: 'realtime', action: 'Verify Realtime channels; reconnect hubs', owner: 'SRE', maxMinutes: 10 },
  { order: 9, service: 'background_workers', action: 'Drain/replay job queues', owner: 'Platform', maxMinutes: 45 },
  { order: 10, service: 'application', action: 'Deploy frontend; activate failover URL if needed', owner: 'Release', maxMinutes: 20 },
  { order: 11, service: 'validation', action: 'Run verify-restore.mjs + manual smoke tests', owner: 'SRE', maxMinutes: 30 },
];

export type ReplicaPromotionProcedure = {
  step: number;
  action: string;
  caution: string;
};

export const READ_REPLICA_PROMOTION_STEPS: ReplicaPromotionProcedure[] = [
  {
    step: 1,
    action: 'Confirm primary is unrecoverable; declare incident',
    caution: 'Promotion is irreversible without full restore',
  },
  {
    step: 2,
    action: 'Stop all writes to failed primary immediately',
    caution: 'Prevent split-brain if primary partially alive',
  },
  {
    step: 3,
    action: 'Supabase Dashboard: promote read replica to primary (or restore PITR to new project)',
    caution: 'Follow Supabase plan-specific promotion docs',
  },
  {
    step: 4,
    action: 'Update DATABASE_URL, pooler URL, and VITE_SUPABASE_* env vars',
    caution: 'All clients and edge functions must pick up new endpoint',
  },
  {
    step: 5,
    action: 'Run platform_health_check(); verify replication lag is zero on new primary',
    caution: 'Do not resume traffic until health check passes',
  },
  {
    step: 6,
    action: 'Re-create read replica from new primary for analytics routing',
    caution: 'Update READ_REPLICA_RPCS routing config',
  },
];

export function getFailoverReadinessSnapshot(): {
  capabilities: FailoverCapability[];
  recoverySequence: ServiceRecoveryStep[];
  replicaPromotion: ReplicaPromotionProcedure[];
  failoverUrlConfigured: boolean;
  readReplicaAvailable: boolean;
} {
  return {
    capabilities: FAILOVER_CAPABILITIES,
    recoverySequence: SERVICE_RECOVERY_SEQUENCE,
    replicaPromotion: READ_REPLICA_PROMOTION_STEPS,
    failoverUrlConfigured: Boolean(env.VITE_FAILOVER_SUPABASE_URL),
    readReplicaAvailable: hasReadReplica(),
  };
}
