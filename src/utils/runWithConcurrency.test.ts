import { describe, expect, it, vi } from 'vitest';
import { runWithConcurrency } from './runWithConcurrency';

describe('runWithConcurrency', () => {
  it('runs tasks with concurrency limit', async () => {
    const order: number[] = [];
    let active = 0;
    let maxActive = 0;

    const items = [1, 2, 3, 4, 5];
    const ok = await runWithConcurrency(items, 2, async (n) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      order.push(n);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return n % 2 === 0;
    });

    expect(ok).toBe(2);
    expect(order).toHaveLength(5);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('returns zero for empty input', async () => {
    const fn = vi.fn();
    expect(await runWithConcurrency([], 3, fn)).toBe(0);
    expect(fn).not.toHaveBeenCalled();
  });
});
