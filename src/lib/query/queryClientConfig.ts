/**
 * TanStack Query defaults aligned with CacheTTLPolicy (src/lib/cache/cacheTtlPolicy.ts).
 * React Query is infrastructure-only today — reads use the L1 cache layer via services.
 * These defaults apply when hooks are introduced; they mirror enterprise tier semantics.
 */
import { QueryCache, MutationCache, QueryClient } from '@tanstack/react-query';
import { CacheTTLPolicy } from '@/lib/cache/cacheTtlPolicy';
import { reportError } from '@/lib/observability';

/** Map CacheTTLPolicy tiers → React Query staleTime / gcTime (ms). */
export const QueryTierDefaults = {
  /** GROUP B/C — orders, workflow counts, merchant catalog lists */
  short: {
    staleTime: CacheTTLPolicy.short.default.ttlMs,
    gcTime: CacheTTLPolicy.short.default.ttlMs + CacheTTLPolicy.short.default.staleWhileRevalidateMs,
  },
  /** GROUP B — dashboard, statistics, product detail, recommendations */
  medium: {
    staleTime: CacheTTLPolicy.medium.default.ttlMs,
    gcTime: CacheTTLPolicy.medium.default.ttlMs + CacheTTLPolicy.medium.default.staleWhileRevalidateMs,
  },
  /** GROUP A — storefront bundles, public marketing */
  long: {
    staleTime: CacheTTLPolicy.long.storefront.ttlMs,
    gcTime: CacheTTLPolicy.long.storefront.ttlMs + CacheTTLPolicy.long.storefront.staleWhileRevalidateMs,
  },
  /** GROUP A — policies, landing, stable config */
  static: {
    staleTime: CacheTTLPolicy.static.policies.ttlMs,
    gcTime: CacheTTLPolicy.static.policies.ttlMs + CacheTTLPolicy.static.policies.staleWhileRevalidateMs,
  },
} as const;

export function createAppQueryClient(): QueryClient {
  const { staleTime, gcTime } = QueryTierDefaults.medium;

  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        reportError(error, { source: 'react-query', queryKey: JSON.stringify(query.queryKey) });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        reportError(error, {
          source: 'react-query-mutation',
          mutationKey: JSON.stringify(mutation.options.mutationKey),
        });
      },
    }),
    defaultOptions: {
      queries: {
        staleTime,
        gcTime,
        retry: 1,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: 'always',
      },
    },
  });
}
