import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordHealthEvent,
  getDomainHealth,
  resetHealthMonitorForTests,
} from '@/lib/observability/healthMonitor';

describe('healthMonitor', () => {
  beforeEach(() => {
    resetHealthMonitorForTests();
  });

  it('tracks successes and failures per domain', () => {
    recordHealthEvent('checkout', true);
    recordHealthEvent('checkout', false, { message: 'stock error' });
    const stats = getDomainHealth('checkout');
    expect(stats.total).toBe(2);
    expect(stats.failures).toBe(1);
    expect(stats.lastFailureMessage).toBe('stock error');
  });

  it('marks domain degraded on repeated failures', () => {
    recordHealthEvent('product.create', false);
    recordHealthEvent('product.create', false);
    recordHealthEvent('product.create', true);
    const stats = getDomainHealth('product.create');
    expect(stats.status).toBe('degraded');
  });
});
