import { describe, expect, it, beforeEach } from 'vitest';
import {
  isLocalOrderMutationEcho,
  markLocalOrderMutation,
  markLocalStorefrontMutation,
  resetLocalMutationGuardsForTests,
  shouldSuppressRealtimeStorefrontInvalidation,
} from './localMutationGuard';

describe('localMutationGuard', () => {
  beforeEach(() => {
    resetLocalMutationGuardsForTests();
  });

  it('suppresses storefront realtime invalidation after local mutation', () => {
    markLocalStorefrontMutation('owner-1');
    expect(shouldSuppressRealtimeStorefrontInvalidation('owner-1')).toBe(true);
  });

  it('suppresses order realtime echo after local status change', () => {
    markLocalOrderMutation('order-1');
    expect(isLocalOrderMutationEcho('order-1')).toBe(true);
  });
});
