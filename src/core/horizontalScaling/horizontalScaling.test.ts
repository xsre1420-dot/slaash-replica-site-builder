import { describe, expect, it, beforeEach } from 'vitest';
import { getScalingAuditSummary, listHighRiskComponents } from '@/core/horizontalScaling/auditRegistry';
import { SESSION_MODEL, CLIENT_SESSION_KEY_PREFIXES } from '@/core/horizontalScaling/sessionReadiness';
import {
  getDeploymentReadiness,
  estimateScalingEfficiency,
  getSupportedDeploymentStrategies,
} from '@/core/horizontalScaling/deploymentReadiness';
import {
  getLivenessProbe,
  getReadinessProbe,
  resetGracefulLifecycleForTests,
} from '@/core/horizontalScaling/probes';
import { listExtractableServices } from '@/core/distributed/serviceBoundaries';
import { getSubsystemForQueue } from '@/core/distributed/failureIsolation';

describe('horizontalScaling audit', () => {
  it('documents components with high multi-server readiness', () => {
    const summary = getScalingAuditSummary();
    expect(summary.total).toBeGreaterThan(10);
    expect(summary.multiServerReady).toBe(summary.total);
    expect(listHighRiskComponents()).toHaveLength(0);
  });
});

describe('session readiness', () => {
  it('uses stateless JWT model', () => {
    expect(SESSION_MODEL.stickySessionsRequired).toBe(false);
    expect(SESSION_MODEL.authProvider).toBe('supabase_jwt');
    expect(CLIENT_SESSION_KEY_PREFIXES.length).toBeGreaterThan(5);
  });
});

describe('deployment readiness', () => {
  it('supports all deployment strategies', () => {
    const strategies = getSupportedDeploymentStrategies();
    expect(strategies).toContain('rolling');
    expect(strategies).toContain('zero_downtime');
    const readiness = getDeploymentReadiness();
    expect(readiness.loadBalancerReady).toBe(true);
    expect(readiness.statelessInstances).toBe(true);
  });

  it('estimates scaling efficiency', () => {
    const e5 = estimateScalingEfficiency(5);
    const e20 = estimateScalingEfficiency(20);
    expect(e5.linearCapacityFactor).toBe(5);
    expect(e20.instances).toBe(20);
    expect(e20.efficiencyPct).toBeLessThanOrEqual(100);
  });
});

describe('health probes', () => {
  beforeEach(() => {
    resetGracefulLifecycleForTests();
  });

  it('liveness probe returns alive', () => {
    const probe = getLivenessProbe();
    expect(probe.alive).toBe(true);
    expect(probe.status).toBe('ok');
  });

  it('readiness probe checks env', () => {
    const probe = getReadinessProbe();
    expect(probe.checks.env).toBe(true);
    expect(typeof probe.ready).toBe('boolean');
  });
});

describe('service isolation extensions', () => {
  it('includes exports and media services', () => {
    expect(listExtractableServices()).toContain('exports');
    expect(listExtractableServices()).toContain('media');
    expect(getSubsystemForQueue('export')?.id).toBe('exports');
    expect(getSubsystemForQueue('image')?.criticality).toBe('best_effort');
  });
});
