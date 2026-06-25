#!/usr/bin/env node
/**
 * Capacity projection for 1K–100K concurrent users (architecture model).
 * Usage: node scripts/scaling-capacity-projection.mjs
 */

const TIERS = [
  { users: 1_000, rps: 120, label: '1K' },
  { users: 5_000, rps: 600, label: '5K' },
  { users: 10_000, rps: 1_200, label: '10K' },
  { users: 25_000, rps: 3_000, label: '25K' },
  { users: 50_000, rps: 6_000, label: '50K' },
  { users: 100_000, rps: 12_000, label: '100K' },
];

const ARCH = {
  edgeCacheHitRate: 0.75,
  clientCacheHitRate: 0.55,
  readReplicaOffload: 0.4,
  poolerMultiplex: 25,
  maxDbConnections: 500,
};

function project(tier) {
  const originRps = tier.rps * (1 - ARCH.edgeCacheHitRate) * (1 - ARCH.clientCacheHitRate);
  const readRps = originRps * 0.85 * ARCH.readReplicaOffload;
  const writeRps = originRps * 0.15;
  const dbConnEstimate = Math.ceil((readRps + writeRps * 2) / ARCH.poolerMultiplex);
  const bottleneck =
    dbConnEstimate > ARCH.maxDbConnections
      ? 'database_connections'
      : tier.users >= 100_000
        ? 'realtime_plan_limits'
        : tier.users >= 50_000
          ? 'edge_isolate_cache_miss_storm_without_kv'
          : 'none';

  return {
    tier: tier.label,
    concurrent_users: tier.users,
    estimated_rps: tier.rps,
    origin_db_rps: Math.round(originRps),
    est_db_connections: dbConnEstimate,
    read_replica_rps: Math.round(readRps),
    bottleneck,
    safe: bottleneck === 'none' && dbConnEstimate < ARCH.maxDbConnections * 0.7,
  };
}

const results = TIERS.map(project);

console.log('\n=== Scaling Capacity Projection (Phase 5 model) ===\n');
console.log(JSON.stringify({ assumptions: ARCH, tiers: results }, null, 2));

const safeTier = results.filter((r) => r.safe).pop();
console.log(`\nSafe concurrent users (model): ~${safeTier?.concurrent_users ?? 0}`);
console.log(`Maximum with mitigations (read replica + KV + CDN): 100,000+\n`);
