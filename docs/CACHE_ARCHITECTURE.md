# Cache Architecture Guide

## Layers

| Layer | Module | Env |
|-------|--------|-----|
| Browser | IndexedDB storefront tiers | — |
| L1 Memory | `src/lib/cache.ts` | — |
| L2 Redis/KV | `src/lib/cache/kvAdapter.ts` | `VITE_KV_REST_*` |
| Edge | `storefrontEdgeService` | `VITE_STOREFRONT_EDGE_ENABLED` |
| CDN | `cdnMediaUtils` | `VITE_CDN_BASE_URL` |
| DB rollups | `store_daily_stats` | migrations |

## Usage

```typescript
import { cachedFetch, cachedFetchNullable } from '@/lib/cache/enterpriseCache';

const data = await cachedFetch({
  key: 'my-key',
  domain: 'dashboard',
  ttlPolicyPath: 'medium.dashboard_batch',
  fetchFn: () => fetchFromDb(),
});
```

## Invalidation

```typescript
import { invalidateByScope, invalidateDashboardCaches } from '@/lib/cache/cacheInvalidation';

invalidateDashboardCaches(ownerId);
invalidateByScope('storefront_products', { slug: 'my-store' });
```

## Monitoring

```typescript
import { getCacheMonitoringSnapshot } from '@/lib/cache/cacheMonitoring';

const snap = getCacheMonitoringSnapshot();
console.log(snap.aggregate.hitRate, snap.aggregate.estimatedDbLoadReductionPct);
```

## Audit

```bash
npm run audit:cache-architecture
```

See `CACHE_ARCHITECTURE_REPORT.md` for full TTL and invalidation tables.
