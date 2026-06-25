import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runOncePerKey } from '@/lib/productCreateLock';
import { dedup } from '@/lib/cache';

describe('resilience behaviors', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('coalesces concurrent product create attempts (rapid clicks)', async () => {
    let calls = 0;
    const task = () =>
      new Promise<{ success: boolean }>((resolve) => {
        calls += 1;
        setTimeout(() => resolve({ success: true }), 30);
      });

    const [a, b, c] = await Promise.all([
      runOncePerKey('merchant:product:1', task),
      runOncePerKey('merchant:product:1', task),
      runOncePerKey('merchant:product:1', task),
    ]);

    expect(calls).toBe(1);
    expect(a.success).toBe(true);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('deduplicates parallel cache fetches (slow network burst)', async () => {
    let fetches = 0;
    const key = `resilience-dedup-${Date.now()}`;
    const fetcher = async () => {
      fetches += 1;
      await new Promise((r) => setTimeout(r, 40));
      return { value: 42 };
    };

    const [r1, r2] = await Promise.all([dedup(key, fetcher), dedup(key, fetcher)]);
    expect(fetches).toBe(1);
    expect(r1).toEqual({ value: 42 });
    expect(r2).toEqual({ value: 42 });
  });

  it('allows separate product create keys after idempotency rotation', async () => {
    let calls = 0;
    const task = async () => {
      calls += 1;
      return { success: true };
    };

    await runOncePerKey('key-a', task);
    await runOncePerKey('key-b', task);
    expect(calls).toBe(2);
  });
});
