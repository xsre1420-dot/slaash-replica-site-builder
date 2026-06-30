import { env } from '@/lib/env';

/** Feature flags derived from validated environment. */
export const features = {
  storefrontEdge:
    env.VITE_STOREFRONT_EDGE_ENABLED === 'true' || env.VITE_STOREFRONT_EDGE_ENABLED === '1',
  readReplica: Boolean(env.VITE_SUPABASE_READ_REPLICA_URL?.trim()),
  regionalReplica: Boolean(env.VITE_SUPABASE_REGIONAL_REPLICA_URL?.trim()),
  connectionPooler: Boolean(env.VITE_SUPABASE_POOLER_URL?.trim()),
  failover: Boolean(env.VITE_FAILOVER_SUPABASE_URL?.trim()),
  distributedCache: Boolean(env.VITE_KV_REST_URL?.trim() && env.VITE_KV_REST_TOKEN?.trim()),
  cdnMedia: Boolean(env.VITE_CDN_BASE_URL?.trim()),
  observabilityClient: env.VITE_OBSERVABILITY_CLIENT_ENABLED === 'true' || env.VITE_OBSERVABILITY_CLIENT_ENABLED === '1',
} as const;

export type FeatureFlag = keyof typeof features;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return features[flag];
}
