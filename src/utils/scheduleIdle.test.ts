import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scheduleIdle } from './scheduleIdle';

describe('scheduleIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs callback after timeout when requestIdleCallback is unavailable', () => {
    const fn = vi.fn();
    scheduleIdle(fn, 100);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('returns a cancel function that prevents execution', () => {
    const fn = vi.fn();
    const cancel = scheduleIdle(fn, 100);
    cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });
});
