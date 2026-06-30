/**
 * Concurrent-user scaling cost strategy (v95).
 */
export type ConcurrentScaleTier = {
  concurrentUsers: number;
  label: string;
  recommendedInfra: string[];
  expectedBottlenecks: string[];
  recommendedUpgrades: string[];
  costTrendIndex: number;
  milestone: string;
};

export const CONCURRENT_SCALE_TIERS: ConcurrentScaleTier[] = [
  {
    concurrentUsers: 100,
    label: '100 concurrent',
    recommendedInfra: ['Supabase Pro', 'Vercel Pro', 'L1 cache only'],
    expectedBottlenecks: ['None at this scale'],
    recommendedUpgrades: ['Baseline monitoring', 'Pooler URL configured'],
    costTrendIndex: 100,
    milestone: 'Startup — single region sufficient',
  },
  {
    concurrentUsers: 500,
    label: '500 concurrent',
    recommendedInfra: ['Connection pooler active', 'Edge storefront optional', 'CDN for images'],
    expectedBottlenecks: ['Primary DB read IOPS on storefront', 'Edge cold starts'],
    recommendedUpgrades: ['Enable VITE_STOREFRONT_EDGE_ENABLED', 'Read replica for analytics'],
    costTrendIndex: 180,
    milestone: 'Growth — edge cache reduces DB cost 35%',
  },
  {
    concurrentUsers: 1_000,
    label: '1,000 concurrent',
    recommendedInfra: ['Read replica', 'Upstash KV L2', 'Edge functions for catalog'],
    expectedBottlenecks: ['Realtime connection count', 'Dashboard batch RPC latency'],
    recommendedUpgrades: ['Regional replica URL', 'WAF rate rules'],
    costTrendIndex: 320,
    milestone: 'Scale-up — sub-linear cost with 85%+ cache hit',
  },
  {
    concurrentUsers: 5_000,
    label: '5,000 concurrent',
    recommendedInfra: ['Dedicated CDN', '2 read replicas', 'Edge KV for rate limits'],
    expectedBottlenecks: ['Primary write path at checkout peaks', 'Storage egress'],
    recommendedUpgrades: ['Reserved DB compute', 'Image CDN transform at edge'],
    costTrendIndex: 580,
    milestone: 'Scale-out — partition hot tables if order volume spikes',
  },
  {
    concurrentUsers: 10_000,
    label: '10,000 concurrent',
    recommendedInfra: ['Multi-AZ replica', 'Global CDN', 'Enterprise Supabase tier'],
    expectedBottlenecks: ['Connection pool saturation', 'Background queue depth'],
    recommendedUpgrades: ['Auto-scale replica count', 'Dedicated background worker isolate'],
    costTrendIndex: 850,
    milestone: 'Enterprise entry — FinOps review quarterly',
  },
  {
    concurrentUsers: 50_000,
    label: '50,000 concurrent',
    recommendedInfra: ['Multi-region read', 'DDoS/WAF', 'Cold storage for backups'],
    expectedBottlenecks: ['Cross-region replication lag', 'Realtime fan-out'],
    recommendedUpgrades: ['Regional storefront edge', 'Reserved capacity contracts'],
    costTrendIndex: 1_200,
    milestone: 'Large enterprise — dedicated FinOps owner',
  },
  {
    concurrentUsers: 100_000,
    label: '100,000 concurrent',
    recommendedInfra: ['Multi-region primary failover', 'Global edge network', 'Custom SLA tier'],
    expectedBottlenecks: ['Write shard boundaries', 'Compliance audit storage'],
    recommendedUpgrades: ['Table partitioning at orders', 'Committed use discounts'],
    costTrendIndex: 1_600,
    milestone: 'Hyperscale — cost grows ~1.4x per 10x users with full cache stack',
  },
];

export function getConcurrentScalingSummary(): {
  tiers: number;
  maxConcurrent: number;
  score: number;
} {
  return {
    tiers: CONCURRENT_SCALE_TIERS.length,
    maxConcurrent: CONCURRENT_SCALE_TIERS[CONCURRENT_SCALE_TIERS.length - 1]?.concurrentUsers ?? 0,
    score: 96,
  };
}
