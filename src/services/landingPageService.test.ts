import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cache } from '@/lib/cache';
import { loadLandingPageBundle, peekLandingPageBundle } from '@/services/landingPageService';

describe('landingPageService', () => {
  beforeEach(() => {
    cache.flushAll();
  });

  it('peekLandingPageBundle returns null when cache is cold', () => {
    expect(peekLandingPageBundle()).toBeNull();
  });

  it('loadLandingPageBundle caches public plans', () => {
    const bundle = loadLandingPageBundle();
    expect(bundle.plans.length).toBeGreaterThan(0);
    expect(bundle.salesWhatsApp).toBeTruthy();
    expect(peekLandingPageBundle()?.plans).toHaveLength(bundle.plans.length);
  });
});
