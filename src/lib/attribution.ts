/**
 * Client-side marketing attribution (UTM + referrer). Persisted per store slug for checkout.
 */
const STORAGE_PREFIX = 'marketing_attribution';

export interface MarketingAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  fbclid?: string;
  gclid?: string;
  referrer?: string;
  landing_path?: string;
  captured_at: string;
}

const storageKey = (storeSlug?: string | null): string => {
  const slug = storeSlug?.trim().toLowerCase();
  return slug ? `${STORAGE_PREFIX}:${slug}` : STORAGE_PREFIX;
};

const readParams = (): MarketingAttribution | null => {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const hasUtm =
    params.has('utm_source') ||
    params.has('utm_medium') ||
    params.has('utm_campaign') ||
    params.has('fbclid') ||
    params.has('gclid');

  if (!hasUtm && !document.referrer) return null;

  return {
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
    utm_term: params.get('utm_term') || undefined,
    utm_content: params.get('utm_content') || undefined,
    fbclid: params.get('fbclid') || undefined,
    gclid: params.get('gclid') || undefined,
    referrer: document.referrer || undefined,
    landing_path: window.location.pathname + window.location.search,
    captured_at: new Date().toISOString(),
  };
};

/** First-touch per store: keep earliest attribution in session for this slug. */
export function captureMarketingAttribution(storeSlug?: string | null): MarketingAttribution | null {
  try {
    const key = storageKey(storeSlug);
    const existing = sessionStorage.getItem(key);
    if (existing) return JSON.parse(existing) as MarketingAttribution;

    const fresh = readParams();
    if (!fresh) return null;

    sessionStorage.setItem(key, JSON.stringify(fresh));
    return fresh;
  } catch {
    return null;
  }
}

export function getStoredMarketingAttribution(storeSlug?: string | null): MarketingAttribution | null {
  try {
    const raw = sessionStorage.getItem(storageKey(storeSlug));
    return raw ? (JSON.parse(raw) as MarketingAttribution) : null;
  } catch {
    return null;
  }
}

export function clearMarketingAttribution(storeSlug?: string | null): void {
  try {
    sessionStorage.removeItem(storageKey(storeSlug));
  } catch {
    /* ignore */
  }
}
