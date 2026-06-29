/**
 * Phase 8 — Platform-wide cache monitoring and savings estimates.
 */
import { getStorefrontCacheMetrics } from '@/services/storefrontCacheTiers';

export type CacheDomain =
  | 'storefront'
  | 'dashboard'
  | 'analytics'
  | 'merchant'
  | 'orders'
  | 'marketing'
  | 'platform'
  | 'other';

type DomainMetrics = {
  hits: number;
  misses: number;
  l2Hits: number;
  rebuilds: number;
  rebuildTimeMsTotal: number;
  invalidations: number;
  fetchFailures: number;
  latencyMsTotal: number;
  estimatedDbQueriesSaved: number;
};

const byDomain = new Map<CacheDomain, DomainMetrics>();

function domainMetrics(domain: CacheDomain): DomainMetrics {
  let m = byDomain.get(domain);
  if (!m) {
    m = {
      hits: 0,
      misses: 0,
      l2Hits: 0,
      rebuilds: 0,
      rebuildTimeMsTotal: 0,
      invalidations: 0,
      fetchFailures: 0,
      latencyMsTotal: 0,
      estimatedDbQueriesSaved: 0,
    };
    byDomain.set(domain, m);
  }
  return m;
}

export function recordCacheHit(
  domain: CacheDomain,
  latencyMs: number,
  layer: 'l1' | 'l2' = 'l1'
): void {
  const m = domainMetrics(domain);
  if (layer === 'l2') m.l2Hits++;
  else m.hits++;
  m.latencyMsTotal += latencyMs;
  m.estimatedDbQueriesSaved++;
  void import('@/lib/monitoring/instrumentation').then(({ recordCacheOperation }) => {
    recordCacheOperation({ domain, hit: true, latencyMs });
  });
}

export function recordCacheMiss(domain: CacheDomain): void {
  domainMetrics(domain).misses++;
  void import('@/lib/monitoring/instrumentation').then(({ recordCacheOperation }) => {
    recordCacheOperation({ domain, hit: false });
  });
}

export function recordCacheRebuild(domain: CacheDomain, durationMs: number): void {
  const m = domainMetrics(domain);
  m.rebuilds++;
  m.rebuildTimeMsTotal += durationMs;
}

export function recordCacheInvalidation(domain: CacheDomain, count = 1): void {
  domainMetrics(domain).invalidations += count;
  void import('@/lib/monitoring/instrumentation').then(({ recordCacheOperation }) => {
    recordCacheOperation({ domain, hit: false, invalidation: true });
  });
}

export function recordCacheFetchFailure(domain: CacheDomain): void {
  domainMetrics(domain).fetchFailures++;
  void import('@/lib/monitoring/instrumentation').then(({ recordCacheOperation }) => {
    recordCacheOperation({ domain, hit: false, failure: true });
  });
}

function hitRate(hits: number, misses: number): number {
  const total = hits + misses;
  return total > 0 ? hits / total : 0;
}

export type CacheMonitoringSnapshot = {
  generatedAt: number;
  domains: Record<
    CacheDomain,
    {
      hits: number;
      misses: number;
      l2Hits: number;
      hitRate: number;
      rebuilds: number;
      avgRebuildMs: number;
      invalidations: number;
      fetchFailures: number;
      avgLatencyMs: number;
      estimatedDbQueriesSaved: number;
    }
  >;
  aggregate: {
    hitRate: number;
    missRate: number;
    totalHits: number;
    totalMisses: number;
    totalRebuilds: number;
    avgRebuildMs: number;
    totalInvalidations: number;
    avgLatencyMs: number;
    estimatedDbQueriesSaved: number;
    estimatedCpuSavingsPct: number;
    estimatedDbLoadReductionPct: number;
  };
  storefront: ReturnType<typeof getStorefrontCacheMetrics>;
};

export function getCacheMonitoringSnapshot(): CacheMonitoringSnapshot {
  const domains = {} as CacheMonitoringSnapshot['domains'];
  let totalHits = 0;
  let totalMisses = 0;
  let totalRebuilds = 0;
  let rebuildTimeTotal = 0;
  let totalInvalidations = 0;
  let latencyTotal = 0;
  let dbSaved = 0;

  for (const [domain, m] of byDomain) {
    const hits = m.hits + m.l2Hits;
    totalHits += hits;
    totalMisses += m.misses;
    totalRebuilds += m.rebuilds;
    rebuildTimeTotal += m.rebuildTimeMsTotal;
    totalInvalidations += m.invalidations;
    latencyTotal += m.latencyMsTotal;
    dbSaved += m.estimatedDbQueriesSaved;

    domains[domain] = {
      hits: m.hits,
      misses: m.misses,
      l2Hits: m.l2Hits,
      hitRate: hitRate(hits, m.misses),
      rebuilds: m.rebuilds,
      avgRebuildMs: m.rebuilds > 0 ? m.rebuildTimeMsTotal / m.rebuilds : 0,
      invalidations: m.invalidations,
      fetchFailures: m.fetchFailures,
      avgLatencyMs: hits > 0 ? m.latencyMsTotal / hits : 0,
      estimatedDbQueriesSaved: m.estimatedDbQueriesSaved,
    };
  }

  const sf = getStorefrontCacheMetrics();
  const sfHits = Object.values(sf.hits).reduce((a, b) => a + b, 0);
  const sfMisses = Object.values(sf.misses).reduce((a, b) => a + b, 0);
  totalHits += sfHits;
  totalMisses += sfMisses;
  dbSaved += sfHits;

  const total = totalHits + totalMisses;
  const aggregateHitRate = total > 0 ? totalHits / total : 0;

  return {
    generatedAt: Date.now(),
    domains,
    aggregate: {
      hitRate: aggregateHitRate,
      missRate: total > 0 ? totalMisses / total : 0,
      totalHits,
      totalMisses,
      totalRebuilds,
      avgRebuildMs: totalRebuilds > 0 ? rebuildTimeTotal / totalRebuilds : 0,
      totalInvalidations,
      avgLatencyMs: totalHits > 0 ? latencyTotal / totalHits : 0,
      estimatedDbQueriesSaved: dbSaved,
      estimatedCpuSavingsPct: Math.round(aggregateHitRate * 72),
      estimatedDbLoadReductionPct: Math.round(aggregateHitRate * 85),
    },
    storefront: sf,
  };
}

/** @internal test helper */
export function resetCacheMonitoringForTests(): void {
  byDomain.clear();
}
