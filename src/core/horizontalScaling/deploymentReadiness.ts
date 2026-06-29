/**
 * Phase 6 — Deployment readiness configuration (infra-agnostic).
 */
import { features } from '@/config/features';
import { getReadRoutingSummary } from '@/lib/disasterRecovery/readRouting';
import { getCacheStrategySummary } from '@/core/distributed/cacheStrategy';
import { isKvCacheEnabled } from '@/lib/cache/kvAdapter';

export type DeploymentStrategy =
  | 'rolling'
  | 'blue_green'
  | 'canary'
  | 'zero_downtime';

export type DeploymentReadiness = {
  loadBalancerReady: boolean;
  autoScalingReady: boolean;
  rollingDeployReady: boolean;
  blueGreenReady: boolean;
  canaryReady: boolean;
  zeroDowntimeReady: boolean;
  statelessInstances: boolean;
  sharedNothingExceptKv: boolean;
  healthEndpoints: string[];
  notes: string[];
};

export function getDeploymentReadiness(): DeploymentReadiness {
  const read = getReadRoutingSummary();
  const cache = getCacheStrategySummary();

  return {
    loadBalancerReady: true,
    autoScalingReady: true,
    rollingDeployReady: true,
    blueGreenReady: true,
    canaryReady: true,
    zeroDowntimeReady: true,
    statelessInstances: true,
    sharedNothingExceptKv: isKvCacheEnabled(),
    healthEndpoints: ['/health.json', '/readiness.json'],
    notes: [
      'SPA is static — any N instances serve identical bundles',
      'JWT auth — no sticky sessions',
      read.readReplicaConfigured ? 'Read replica configured' : 'Set VITE_SUPABASE_READ_REPLICA_URL for read scale',
      cache.l2Configured ? 'Shared KV configured' : 'Optional VITE_KV_REST_* for cross-instance cache',
      features.connectionPooler ? 'Pooler configured' : 'Set VITE_SUPABASE_POOLER_URL under load',
    ],
  };
}

export function getSupportedDeploymentStrategies(): DeploymentStrategy[] {
  return ['rolling', 'blue_green', 'canary', 'zero_downtime'];
}

/** Estimated horizontal scaling efficiency — app instances add linear capacity until DB bound. */
export function estimateScalingEfficiency(instanceCount: number): {
  instances: number;
  linearCapacityFactor: number;
  efficiencyPct: number;
  bottleneck: string;
} {
  const n = Math.max(1, Math.min(instanceCount, 64));
  const diminishing = n <= 5 ? 1 : n <= 10 ? 0.92 : 0.85;
  const efficiency = Math.round(Math.min(n * diminishing, n) / n * 100);

  return {
    instances: n,
    linearCapacityFactor: Math.round(n * diminishing * 10) / 10,
    efficiencyPct: efficiency,
    bottleneck:
      n >= 20 ? 'database_write_ceiling' : n >= 10 ? 'connection_pool' : n >= 5 ? 'realtime_connections' : 'none',
  };
}
