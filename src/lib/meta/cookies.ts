import { getStoredMarketingAttribution } from '@/lib/attribution';
import type { MetaBrowserContext } from '@/lib/meta/types';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getMetaFbpCookie(): string | null {
  return readCookie('_fbp');
}

export function getMetaFbcCookie(storeSlug?: string | null): string | null {
  const existing = readCookie('_fbc');
  if (existing) return existing;

  const attribution = getStoredMarketingAttribution(storeSlug);
  const fbclid = attribution?.fbclid?.trim();
  if (!fbclid) return null;

  // Meta format: fb.1.{creationTime}.{fbclid}
  return `fb.1.${Date.now()}.${fbclid}`;
}

export function getMetaBrowserContext(storeSlug?: string | null): MetaBrowserContext {
  return {
    fbp: getMetaFbpCookie(),
    fbc: getMetaFbcCookie(storeSlug),
    eventSourceUrl: typeof window !== 'undefined' ? window.location.href : '',
  };
}
