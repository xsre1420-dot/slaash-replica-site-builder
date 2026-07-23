/**
 * Public store URL helpers — shareable links for merchants and customers.
 */
import { env } from '@/lib/env';
import { ensureMerchantStoreSlug, fetchCustomDomainSettings } from '@/services/storeService';
import { resolveStoreSlugByOwnerId } from '@/services/storefrontProductService';

const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export type EnsureStoreSlugOptions = {
  username?: string;
  storeName?: string;
};

export async function getStorePublicSlug(
  ownerId: string,
  options?: EnsureStoreSlugOptions
): Promise<string | null> {
  return ensureStorePublicSlug(ownerId, options);
}

/** Ensure slug exists in DB, then return it. */
export async function ensureStorePublicSlug(
  ownerId: string,
  options?: EnsureStoreSlugOptions
): Promise<string | null> {
  return ensureMerchantStoreSlug(ownerId, options);
}

/** Read slug without auto-provisioning (internal / cache warm paths). */
export async function peekStorePublicSlug(ownerId: string): Promise<string | null> {
  return resolveStoreSlugByOwnerId(ownerId);
}

/** Normalize configured or runtime origin for shareable URLs. */
export function normalizePublicOrigin(origin: string): string {
  const trimmed = origin.trim().replace(/\/$/, '');
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    if (LOCAL_ORIGIN_RE.test(trimmed)) return trimmed;
    return trimmed.replace(/^http:\/\//i, 'https://');
  }

  return `https://${trimmed}`;
}

/** Canonical app origin for customer-facing store links. */
export function getPublicAppOrigin(): string {
  const configured = env.VITE_PUBLIC_APP_URL?.trim();
  if (configured) return normalizePublicOrigin(configured);

  if (typeof window !== 'undefined') {
    return normalizePublicOrigin(window.location.origin);
  }

  return '';
}

export function isLocalDevOrigin(origin = getPublicAppOrigin()): boolean {
  return LOCAL_ORIGIN_RE.test(origin);
}

export function buildStorePublicUrl(slug: string, origin = getPublicAppOrigin()): string {
  const base = origin.replace(/\/$/, '');
  const normalizedSlug = slug.trim().toLowerCase();
  return `${base}/store/${encodeURIComponent(normalizedSlug)}`;
}

export async function resolveStorePublicUrl(
  ownerId: string,
  options?: EnsureStoreSlugOptions
): Promise<string | null> {
  const slug = await ensureStorePublicSlug(ownerId, options);
  if (!slug) return null;

  try {
    const domainSettings = await fetchCustomDomainSettings(ownerId);
    if (domainSettings?.custom_domain?.trim() && domainSettings.domain_verified) {
      const host = domainSettings.custom_domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '');
      return normalizePublicOrigin(host);
    }
  } catch {
    /* custom domain optional */
  }

  return buildStorePublicUrl(slug);
}

export async function copyStorePublicUrl(
  ownerId: string,
  options?: EnsureStoreSlugOptions
): Promise<string | null> {
  const url = await resolveStorePublicUrl(ownerId, options);
  if (!url) return null;
  await navigator.clipboard.writeText(url);
  return url;
}

export function getStoreLinkShareHint(url: string | null): string | null {
  if (!url) return null;
  try {
    if (isLocalDevOrigin(new URL(url).origin)) {
      return 'هذا رابط للتجربة على جهازك. للمشاركة مع العملاء، انشر الموقع أو اضبط VITE_PUBLIC_APP_URL في .env';
    }
  } catch {
    return null;
  }
  return 'افتح الرابط من شريط عنوان المتصفح مباشرة — أو شاركه مع عملائك عبر واتساب.';
}
