import { describe, it, expect, beforeEach } from 'vitest';
import {
  getResourceRightSizingSummary,
  getConcurrentScalingSummary,
  getOperationalEfficiencySummary,
  getFinOpsRecommendationsSummary,
  getFinOpsScalingStatus,
  resetFinOpsScalingForTests,
  shouldSuspendWorkerPolling,
  RESOURCE_SIZING_REGISTRY,
  CONCURRENT_SCALE_TIERS,
  FINOPS_RECOMMENDATIONS,
  OPERATIONAL_RETENTION_POLICY,
} from '@/lib/finOpsScaling';

describe('finops and scaling', () => {
  beforeEach(() => {
    resetFinOpsScalingForTests();
  });

  it('resource right-sizing covers all infrastructure areas', () => {
    const sizing = getResourceRightSizingSummary();
    expect(sizing.resources).toBeGreaterThanOrEqual(10);
    expect(sizing.score).toBeGreaterThanOrEqual(95);
    expect(RESOURCE_SIZING_REGISTRY.some((r) => r.category === 'database')).toBe(true);
    expect(RESOURCE_SIZING_REGISTRY.some((r) => r.category === 'read_replicas')).toBe(true);
    expect(RESOURCE_SIZING_REGISTRY.some((r) => r.category === 'edge_functions')).toBe(true);
  });

  it('concurrent scaling tiers span 100 to 100k users', () => {
    const scale = getConcurrentScalingSummary();
    expect(scale.tiers).toBe(7);
    expect(CONCURRENT_SCALE_TIERS[0]?.concurrentUsers).toBe(100);
    expect(CONCURRENT_SCALE_TIERS[6]?.concurrentUsers).toBe(100_000);
    expect(scale.score).toBeGreaterThanOrEqual(95);
  });

  it('operational retention policies defined for all domains', () => {
    const ops = getOperationalEfficiencySummary();
    expect(OPERATIONAL_RETENTION_POLICY.length).toBeGreaterThanOrEqual(6);
    expect(ops.score).toBeGreaterThanOrEqual(95);
    expect(ops.optimizations).toBeGreaterThanOrEqual(6);
  });

  it('finops recommendations cover all optimization categories', () => {
    const finops = getFinOpsRecommendationsSummary();
    expect(FINOPS_RECOMMENDATIONS.length).toBeGreaterThanOrEqual(10);
    expect(finops.categories).toContain('database');
    expect(finops.categories).toContain('caching');
    expect(finops.score).toBeGreaterThanOrEqual(95);
  });

  it('worker suspend when hidden and idle', () => {
    expect(shouldSuspendWorkerPolling(true)).toBe(false);
  });

  it('finops scaling status scores all target 95+', () => {
    const status = getFinOpsScalingStatus();
    expect(status.scores.finOps).toBeGreaterThanOrEqual(95);
    expect(status.scores.infrastructureEfficiency).toBeGreaterThanOrEqual(95);
    expect(status.scores.scalabilityPlanning).toBeGreaterThanOrEqual(95);
    expect(status.scores.operationalEfficiency).toBeGreaterThanOrEqual(95);
    expect(status.scores.productionReadiness).toBeGreaterThanOrEqual(95);
  });

  it('v95 optimizations and roadmap documented', () => {
    const status = getFinOpsScalingStatus();
    expect(status.schemaVersion).toBe(95);
    expect(status.optimizationsApplied.length).toBeGreaterThanOrEqual(5);
    expect(status.remainingOpportunities.length).toBeGreaterThanOrEqual(4);
    expect(status.priorPhase.infrastructureEfficiency).toBeGreaterThanOrEqual(95);
  });
});
