/**
 * Runtime infrastructure activation snapshot — read-only diagnostic.
 * Used by health dashboards and env validation; does not change routing behavior.
 */
import { features } from '@/config/features';
import { env } from '@/lib/env';
import { getReadRoutingSummary } from '@/lib/readWrite/readRouter';
import { isKvCacheEnabled } from '@/lib/cache/kvAdapter';
import { isStorefrontEdgeActive, resolveStorefrontEdgeUrl } from '@/services/storefrontEdgeService';

export type InfrastructureFeatureStatus =
  | 'active'
  | 'configured'
  | 'disabled'
  | 'not_configured';

export type InfrastructureFeature = {
  id: string;
  name: string;
  status: InfrastructureFeatureStatus;
  notes: string;
};

function edgeStatus(): InfrastructureFeatureStatus {
  if (isStorefrontEdgeActive()) return 'active';
  return 'not_configured';
}

/** Snapshot of enterprise infrastructure flags at runtime. */
export function getInfrastructureSnapshot(): {
  features: InfrastructureFeature[];
  readRouting: ReturnType<typeof getReadRoutingSummary>;
  score: number;
} {
  const readRouting = getReadRoutingSummary();

  const items: InfrastructureFeature[] = [
    {
      id: 'read_router',
      name: 'Read Router',
      status: 'active',
      notes: 'Centralized via callReadRpc + readConsistencyRegistry',
    },
    {
      id: 'write_router',
      name: 'Write Router',
      status: 'active',
      notes: 'callWriteRpc forces primary with transport fallback',
    },
    {
      id: 'read_replica',
      name: 'Read Replica',
      status: features.readReplica ? 'active' : 'not_configured',
      notes: features.readReplica
        ? env.VITE_SUPABASE_READ_REPLICA_URL ?? ''
        : 'Set VITE_SUPABASE_READ_REPLICA_URL to activate',
    },
    {
      id: 'regional_replica',
      name: 'Regional Replica',
      status: features.regionalReplica ? 'active' : 'not_configured',
      notes: 'Optional multi-region read scaling',
    },
    {
      id: 'connection_pooler',
      name: 'Connection Pooler',
      status: features.connectionPooler ? 'configured' : 'not_configured',
      notes: features.connectionPooler
        ? 'x-connection-mode: pooler header enabled on RPC fetch'
        : 'Set VITE_SUPABASE_POOLER_URL for Supavisor compatibility',
    },
    {
      id: 'storefront_edge',
      name: 'Edge Storefront',
      status: edgeStatus(),
      notes: resolveStorefrontEdgeUrl() ?? 'Deploy get-store-products edge function',
    },
    {
      id: 'cdn_media',
      name: 'CDN Media',
      status: features.cdnMedia ? 'active' : 'not_configured',
      notes: features.cdnMedia ? env.VITE_CDN_BASE_URL ?? '' : 'Set VITE_CDN_BASE_URL',
    },
    {
      id: 'l2_kv',
      name: 'L2 KV Cache',
      status: isKvCacheEnabled() ? 'active' : 'not_configured',
      notes: isKvCacheEnabled() ? 'Upstash REST connected' : 'Set VITE_KV_REST_URL + VITE_KV_REST_TOKEN',
    },
    {
      id: 'circuit_breaker',
      name: 'Circuit Breaker',
      status: 'active',
      notes: 'RPC layer with replica → primary fallback',
    },
    {
      id: 'service_worker',
      name: 'Service Worker',
      status: typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? 'configured' : 'disabled',
      notes: 'Production only; bypasses Supabase REST API cache',
    },
    {
      id: 'failover',
      name: 'DR Failover',
      status: features.failover ? 'configured' : 'not_configured',
      notes: 'Session-scoped failover URL swap',
    },
    {
      id: 'realtime_hub',
      name: 'Realtime Hub',
      status: 'active',
      notes: 'Shared merchantRealtimeHub — single channel per merchant',
    },
    {
      id: 'background_queue',
      name: 'Background Queue',
      status: 'active',
      notes: 'Client IndexedDB queues + server outbox workers',
    },
  ];

  const activeCount = items.filter((f) => f.status === 'active' || f.status === 'configured').length;
  const score = Math.round((activeCount / items.length) * 100);

  return { features: items, readRouting, score };
}
