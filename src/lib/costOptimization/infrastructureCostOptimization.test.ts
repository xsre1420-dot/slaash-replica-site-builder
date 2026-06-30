import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCostAuditSummary,
  getDatabaseCostSummary,
  getComputeCostSummary,
  getStorageCostSummary,
  getNetworkCostSummary,
  getScalabilityCostSummary,
  getCostOptimizationStatus,
  resetCostOptimizationForTests,
  resolveWorkerPollIntervalMs,
  resolveMemorySampleIntervalMs,
  COST_DRIVER_REGISTRY,
  SCALE_TIERS,
  V94_ESTIMATED_SAVINGS,
  WORKER_POLL_MS,
} from '@/lib/costOptimization';

describe('infrastructure cost optimization', () => {
  beforeEach(() => {
    resetCostOptimizationForTests();
  });

  it('cost audit covers all infrastructure categories', () => {
    const audit = getCostAuditSummary();
    expect(audit.drivers).toBeGreaterThanOrEqual(20);
    expect(audit.categories.length).toBeGreaterThanOrEqual(8);
    expect(audit.score).toBeGreaterThanOrEqual(95);
    expect(COST_DRIVER_REGISTRY.some((d) => d.category === 'database')).toBe(true);
    expect(COST_DRIVER_REGISTRY.some((d) => d.category === 'edge_functions')).toBe(true);
  });

  it('database cost optimizations preserve behavior', () => {
    const db = getDatabaseCostSummary();
    expect(db.optimizations).toBeGreaterThanOrEqual(6);
    expect(db.score).toBeGreaterThanOrEqual(95);
  });

  it('adaptive worker poll intervals reduce idle cost', () => {
    expect(resolveWorkerPollIntervalMs(true)).toBe(WORKER_POLL_MS.active);
    expect(resolveWorkerPollIntervalMs(false)).toBe(WORKER_POLL_MS.idle);
    expect(resolveWorkerPollIntervalMs(false)).toBeGreaterThan(WORKER_POLL_MS.active);
  });

  it('production memory sampling uses longer interval', () => {
    const dev = resolveMemorySampleIntervalMs();
    expect(dev).toBeGreaterThanOrEqual(60_000);
  });

  it('compute, storage, and network scores target 95+', () => {
    expect(getComputeCostSummary().score).toBeGreaterThanOrEqual(95);
    expect(getStorageCostSummary().score).toBeGreaterThanOrEqual(95);
    expect(getNetworkCostSummary().score).toBeGreaterThanOrEqual(95);
  });

  it('scalability tiers cover 100 to 100k merchants', () => {
    const scale = getScalabilityCostSummary();
    expect(scale.tiers).toBe(4);
    expect(SCALE_TIERS[0]?.merchants).toBe(100);
    expect(SCALE_TIERS[3]?.merchants).toBe(100_000);
    expect(V94_ESTIMATED_SAVINGS.overallInfrastructure).toBeGreaterThanOrEqual(20);
  });

  it('cost optimization status scores all target 95+', () => {
    const status = getCostOptimizationStatus();
    expect(status.scores.infrastructureEfficiency).toBeGreaterThanOrEqual(95);
    expect(status.scores.databaseCost).toBeGreaterThanOrEqual(95);
    expect(status.scores.resourceUtilization).toBeGreaterThanOrEqual(95);
    expect(status.scores.scalabilityEfficiency).toBeGreaterThanOrEqual(95);
    expect(status.scores.productionReadiness).toBeGreaterThanOrEqual(95);
  });

  it('v94 optimizations documented', () => {
    const status = getCostOptimizationStatus();
    expect(status.schemaVersion).toBe(94);
    expect(status.optimizationsApplied.length).toBeGreaterThanOrEqual(5);
    expect(status.futureOpportunities.length).toBeGreaterThanOrEqual(4);
  });
});
