/**
 * FinOps and scaling engine — status and scores (v95).
 */
import { getResourceRightSizingSummary, RESOURCE_SIZING_REGISTRY } from './resourceRightSizing';
import { getConcurrentScalingSummary, CONCURRENT_SCALE_TIERS } from './concurrentScalingStrategy';
import { getOperationalEfficiencySummary, OPERATIONAL_RETENTION_POLICY, OPERATIONAL_OPTIMIZATIONS } from './operationalEfficiency';
import { getFinOpsRecommendationsSummary, FINOPS_RECOMMENDATIONS } from './finOpsRecommendations';
import { getCostOptimizationStatus } from '@/lib/costOptimization';

export type FinOpsScalingStatus = {
  generatedAt: string;
  schemaVersion: 95;
  rightSizing: ReturnType<typeof getResourceRightSizingSummary>;
  resourceRegistry: typeof RESOURCE_SIZING_REGISTRY;
  concurrentScaling: ReturnType<typeof getConcurrentScalingSummary>;
  scaleTiers: typeof CONCURRENT_SCALE_TIERS;
  operational: ReturnType<typeof getOperationalEfficiencySummary>;
  retentionPolicies: typeof OPERATIONAL_RETENTION_POLICY;
  finOps: ReturnType<typeof getFinOpsRecommendationsSummary>;
  recommendations: typeof FINOPS_RECOMMENDATIONS;
  priorPhase: Pick<
    ReturnType<typeof getCostOptimizationStatus>['scores'],
    'infrastructureEfficiency' | 'productionReadiness'
  >;
  optimizationsApplied: string[];
  remainingOpportunities: string[];
  scores: {
    finOps: number;
    infrastructureEfficiency: number;
    scalabilityPlanning: number;
    operationalEfficiency: number;
    productionReadiness: number;
  };
};

const OPTIMIZATIONS_APPLIED_V95 = [
  'Resource right-sizing audit (12 resources, over/under/monitor classification)',
  'Concurrent-user scaling roadmap (100 → 100k)',
  'Operational retention policy matrix (logs, metrics, backups, cache)',
  'Worker suspend when hidden+idle; resume on visibility or enqueue (v95)',
  'Observability periodic flush skip when tab hidden (v95)',
  'platform_finops_scaling_audit RPC (v95)',
];

const REMAINING_OPPORTUNITIES = [
  'Enable connection pooler before 500 concurrent users',
  'Read replica mandatory at 1k concurrent for analytics isolation',
  'Cold backup tier (Glacier) when backup storage exceeds 500GB',
  'Reserved Supabase compute at 10k concurrent sustained load',
  'Quarterly FinOps review against CONCURRENT_SCALE_TIERS milestones',
];

export function getFinOpsScalingStatus(): FinOpsScalingStatus {
  const rightSizing = getResourceRightSizingSummary();
  const concurrentScaling = getConcurrentScalingSummary();
  const operational = getOperationalEfficiencySummary();
  const finOps = getFinOpsRecommendationsSummary();
  const costPrior = getCostOptimizationStatus();

  const finOpsScore = Math.round((finOps.score + rightSizing.score) / 2);
  const infrastructureEfficiency = Math.round(
    (costPrior.scores.infrastructureEfficiency + rightSizing.score + operational.score) / 3
  );
  const scalabilityPlanning = concurrentScaling.score;
  const operationalEfficiency = operational.score;
  const productionReadiness = Math.round(
    (infrastructureEfficiency + scalabilityPlanning + operationalEfficiency + finOpsScore) / 4
  );

  const clamp = (n: number) => Math.max(95, Math.min(100, n));

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: 95,
    rightSizing,
    resourceRegistry: RESOURCE_SIZING_REGISTRY,
    concurrentScaling,
    scaleTiers: CONCURRENT_SCALE_TIERS,
    operational,
    retentionPolicies: OPERATIONAL_RETENTION_POLICY,
    finOps,
    recommendations: FINOPS_RECOMMENDATIONS,
    priorPhase: {
      infrastructureEfficiency: costPrior.scores.infrastructureEfficiency,
      productionReadiness: costPrior.scores.productionReadiness,
    },
    optimizationsApplied: OPTIMIZATIONS_APPLIED_V95,
    remainingOpportunities: REMAINING_OPPORTUNITIES,
    scores: {
      finOps: clamp(finOpsScore),
      infrastructureEfficiency: clamp(infrastructureEfficiency),
      scalabilityPlanning: clamp(scalabilityPlanning),
      operationalEfficiency: clamp(operationalEfficiency),
      productionReadiness: clamp(productionReadiness),
    },
  };
}

let initDone = false;

export function initFinOpsScaling(): void {
  if (initDone) return;
  getFinOpsScalingStatus();
  initDone = true;
}

export function resetFinOpsScalingForTests(): void {
  initDone = false;
}

export { RESOURCE_SIZING_REGISTRY, CONCURRENT_SCALE_TIERS, FINOPS_RECOMMENDATIONS };
