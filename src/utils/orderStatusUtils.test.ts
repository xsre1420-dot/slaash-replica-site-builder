import { describe, it, expect } from 'vitest';
import { canTransitionOrderStatus, getAllowedNextStatuses } from '@/utils/orderStatusUtils';

describe('orderStatusUtils', () => {
  it('allows pending -> completed', () => {
    expect(canTransitionOrderStatus('pending', 'completed')).toBe(true);
  });

  it('allows pending -> cancelled', () => {
    expect(canTransitionOrderStatus('pending', 'cancelled')).toBe(true);
  });

  it('blocks completed -> pending', () => {
    expect(canTransitionOrderStatus('completed', 'pending')).toBe(false);
  });

  it('returns allowed next statuses for pending', () => {
    expect(getAllowedNextStatuses('pending')).toEqual(['completed', 'cancelled']);
  });
});
