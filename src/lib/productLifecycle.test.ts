import { describe, it, expect } from 'vitest';
import {
  getProductLifecycleStatus,
  matchesLifecycleFilter,
  isStorefrontVisible,
} from '@/lib/productLifecycle';
import { Product } from '@/types';

const base = (overrides: Partial<Product> = {}): Product => ({
  id: '1',
  name: 'Test',
  description: '',
  category: 'c',
  price: 100,
  image: '',
  ...overrides,
});

describe('productLifecycle', () => {
  it('classifies published, draft, and archived', () => {
    expect(getProductLifecycleStatus(base({ isActive: true }))).toBe('published');
    expect(getProductLifecycleStatus(base({ isActive: false }))).toBe('draft');
    expect(getProductLifecycleStatus(base({ isActive: false, archivedAt: '2026-01-01T00:00:00Z' }))).toBe('archived');
  });

  it('filters by lifecycle', () => {
    const draft = base({ isActive: false });
    expect(matchesLifecycleFilter(draft, 'draft')).toBe(true);
    expect(matchesLifecycleFilter(draft, 'published')).toBe(false);
  });

  it('storefront visibility excludes draft and archived', () => {
    expect(isStorefrontVisible(base({ isActive: true }))).toBe(true);
    expect(isStorefrontVisible(base({ isActive: false }))).toBe(false);
    expect(isStorefrontVisible(base({ archivedAt: '2026-01-01T00:00:00Z' }))).toBe(false);
    expect(
      isStorefrontVisible(base({ isActive: true, archivedAt: '2026-01-01T00:00:00Z' }))
    ).toBe(false);
  });
});
