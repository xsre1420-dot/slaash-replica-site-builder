import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyzeMediaUrl,
  auditMediaUrlSet,
  buildStoragePublicUrl,
  buildResponsiveImageSources,
  CDN_CACHE_MAX_AGE_SECONDS,
  isVersionedStorageAsset,
  resetMediaDeliveryMetricsForTests,
  resolveMediaDeliveryUrl,
  resolveThumbnailUrl,
  getMediaDeliveryMetrics,
} from './cdnMediaUtils';
import { STORAGE_BUCKET } from './storageMediaUtils';

const owner = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const file = `${owner}/11111111-2222-3333-4444-555555555555.webp`;
const publicUrl = `https://xyz.supabase.co/storage/v1/object/public/${STORAGE_BUCKET}/${file}`;

describe('cdnMediaUtils', () => {
  beforeEach(() => resetMediaDeliveryMetricsForTests());

  it('exposes CDN cache max age aligned with upload', () => {
    expect(CDN_CACHE_MAX_AGE_SECONDS).toBe(31_536_000);
  });

  it('resolves thumbnail URL from full storage URL', () => {
    const thumb = resolveThumbnailUrl(publicUrl);
    expect(thumb).toContain('/thumbs/');
    expect(thumb).toContain('11111111-2222-3333-4444-555555555555.webp');
  });

  it('resolveMediaDeliveryUrl prefers thumbnail variant', () => {
    const url = resolveMediaDeliveryUrl(publicUrl, { variant: 'thumbnail' });
    expect(url).toContain('/thumbs/');
    expect(getMediaDeliveryMetrics().thumbnailResolved).toBe(1);
  });

  it('buildResponsiveImageSources emits srcSet for storage assets', () => {
    const { src, srcSet, sizes } = buildResponsiveImageSources(publicUrl, { variant: 'thumbnail' });
    expect(src).toContain('/thumbs/');
    expect(srcSet).toContain('400w');
    expect(srcSet).toContain('1200w');
    expect(sizes).toBeTruthy();
  });

  it('passes through external URLs unchanged', () => {
    const external = 'https://cdn.example.com/product.jpg';
    expect(resolveMediaDeliveryUrl(external)).toBe(external);
    expect(getMediaDeliveryMetrics().externalPassthrough).toBe(1);
  });

  it('detects versioned UUID storage assets', () => {
    expect(isVersionedStorageAsset(publicUrl)).toBe(true);
    expect(isVersionedStorageAsset('https://example.com/static/logo.png')).toBe(false);
  });

  it('buildStoragePublicUrl reconstructs public URL', () => {
    expect(buildStoragePublicUrl(file, 'https://xyz.supabase.co')).toBe(publicUrl);
  });

  it('analyzeMediaUrl flags grid oversize without thumb path', () => {
    const hint = analyzeMediaUrl(publicUrl, 'grid');
    expect(hint.potentiallyOversized).toBe(true);
    expect(hint.hasThumbnailCompanion).toBe(true);
  });

  it('auditMediaUrlSet aggregates duplicate and format stats', () => {
    const report = auditMediaUrlSet([publicUrl, publicUrl, 'https://other.com/x.png'], 'grid');
    expect(report.total).toBe(3);
    expect(report.duplicateUrls).toContain(publicUrl);
    expect(report.ourStorage).toBe(2);
    expect(report.external).toBe(1);
  });
});
