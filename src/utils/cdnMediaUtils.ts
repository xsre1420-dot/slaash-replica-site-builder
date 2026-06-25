/**
 * CDN-friendly media URL resolution — thumbnails, immutable caching, format hints.
 */
import {
  isOurStorageUrl,
  parseStorageObjectPath,
  thumbPathFor,
  STORAGE_BUCKET,
} from '@/utils/storageMediaUtils';

/** Matches upload cacheControl in imageUpload.ts (1 year). */
export const CDN_CACHE_MAX_AGE_SECONDS = 31_536_000;

export type MediaDeliveryVariant = 'thumbnail' | 'display' | 'original';

export interface MediaDeliveryOptions {
  variant?: MediaDeliveryVariant;
  /** When true, prefer thumbnail for grid/card contexts even if variant is display. */
  preferThumbnail?: boolean;
}

export interface MediaAuditHint {
  url: string;
  isOurStorage: boolean;
  format: string | null;
  objectPath: string | null;
  hasThumbnailCompanion: boolean;
  potentiallyOversized: boolean;
  recommendation: string | null;
}

type DeliveryMetrics = {
  thumbnailResolved: number;
  displayResolved: number;
  externalPassthrough: number;
};

const metrics: DeliveryMetrics = {
  thumbnailResolved: 0,
  displayResolved: 0,
  externalPassthrough: 0,
};

export function getMediaDeliveryMetrics(): DeliveryMetrics {
  return { ...metrics };
}

export function resetMediaDeliveryMetricsForTests(): void {
  metrics.thumbnailResolved = 0;
  metrics.displayResolved = 0;
  metrics.externalPassthrough = 0;
}

/** Reconstruct public URL from object path (same shape as getPublicUrl). */
export function buildStoragePublicUrl(
  objectPath: string,
  supabaseUrl?: string
): string | null {
  if (!objectPath?.trim()) return null;
  const cdnBase =
    (typeof import.meta !== 'undefined' &&
      (import.meta.env.VITE_CDN_BASE_URL as string | undefined)?.replace(/\/$/, '')) ||
    '';
  if (cdnBase) {
    return `${cdnBase}/${objectPath.replace(/^\//, '')}`;
  }
  const base =
    supabaseUrl?.replace(/\/$/, '') ||
    (typeof import.meta !== 'undefined' &&
      (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '')) ||
    '';
  if (!base) return null;
  return `${base}/storage/v1/object/public/${STORAGE_BUCKET}/${objectPath}`;
}

/** Resolve thumbnail URL from a full storage public URL. */
export function resolveThumbnailUrl(publicUrl: string): string | null {
  const objectPath = parseStorageObjectPath(publicUrl);
  if (!objectPath) return null;
  if (objectPath.includes('/thumbs/')) return publicUrl;
  const thumbPath = thumbPathFor(objectPath);
  if (!thumbPath) return null;
  return buildStoragePublicUrl(thumbPath) ?? publicUrl;
}

/**
 * Pick CDN-optimal URL for context.
 * - thumbnail: 400px companion (grid, cart, logo)
 * - display: full compressed upload (PDP hero, banners)
 * - original: alias of display (immutable UUID paths)
 */
export function resolveMediaDeliveryUrl(
  publicUrl: string | null | undefined,
  options: MediaDeliveryOptions = {}
): string {
  const trimmed = publicUrl?.trim();
  if (!trimmed) return '/placeholder.svg';

  if (!isOurStorageUrl(trimmed)) {
    metrics.externalPassthrough++;
    return trimmed;
  }

  const variant = options.variant ?? (options.preferThumbnail ? 'thumbnail' : 'display');

  if (variant === 'thumbnail') {
    const thumb = resolveThumbnailUrl(trimmed);
    if (thumb && thumb !== trimmed) {
      metrics.thumbnailResolved++;
      return thumb;
    }
  }

  metrics.displayResolved++;
  return trimmed;
}

/** Asset versioning: UUID filenames are content-addressed — URL change = cache bust. */
export function isVersionedStorageAsset(publicUrl: string): boolean {
  const path = parseStorageObjectPath(publicUrl);
  if (!path) return false;
  return /[0-9a-f-]{36}\.(webp|jpg|jpeg|png)$/i.test(path.split('/').pop() ?? '');
}

/** Audit helper — oversize / format / duplicate hints for a single URL. */
export function analyzeMediaUrl(
  publicUrl: string,
  context: 'grid' | 'detail' | 'banner' | 'logo' = 'grid'
): MediaAuditHint {
  const isOur = isOurStorageUrl(publicUrl);
  const objectPath = isOur ? parseStorageObjectPath(publicUrl) : null;
  const ext = publicUrl.split('?')[0].split('.').pop()?.toLowerCase() ?? null;
  const hasThumb = isOur && objectPath ? !!thumbPathFor(objectPath) : false;

  let potentiallyOversized = false;
  let recommendation: string | null = null;

  if (!isOur && publicUrl.startsWith('http')) {
    recommendation = 'Host on Supabase storage for CDN cache headers and compression';
  } else if (isOur && context === 'grid' && objectPath && !objectPath.includes('/thumbs/')) {
    potentiallyOversized = true;
    recommendation = hasThumb
      ? 'Use thumbnail variant in grid/card contexts (~90% smaller transfer)'
      : 'Re-upload to generate thumbnail companion';
  } else if (ext === 'png' || ext === 'jpeg' || ext === 'jpg') {
    recommendation = 'Prefer WebP upload pipeline (automatic on new uploads)';
  }

  return {
    url: publicUrl,
    isOurStorage: isOur,
    format: ext,
    objectPath,
    hasThumbnailCompanion: hasThumb,
    potentiallyOversized,
    recommendation,
  };
}

/** Batch audit for product + branding URLs. */
export function auditMediaUrlSet(
  urls: string[],
  context: 'grid' | 'detail' | 'banner' | 'logo' = 'grid'
): {
  total: number;
  ourStorage: number;
  external: number;
  oversizedForContext: number;
  nonWebp: number;
  duplicateUrls: string[];
  hints: MediaAuditHint[];
} {
  const hints = urls.filter(Boolean).map((u) => analyzeMediaUrl(u, context));
  const seen = new Set<string>();
  const duplicateUrls: string[] = [];

  for (const url of urls) {
    if (!url) continue;
    if (seen.has(url)) duplicateUrls.push(url);
    seen.add(url);
  }

  return {
    total: urls.length,
    ourStorage: hints.filter((h) => h.isOurStorage).length,
    external: hints.filter((h) => !h.isOurStorage && h.url.startsWith('http')).length,
    oversizedForContext: hints.filter((h) => h.potentiallyOversized).length,
    nonWebp: hints.filter((h) => h.format && h.format !== 'webp').length,
    duplicateUrls,
    hints,
  };
}
