/**
 * Phase 12: Subdomain routing — store1.platform.com → /store/store1
 */

const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'admin', 'mail', 'cdn', 'static', 'dev', 'staging',
]);

export function parseStoreSlugFromHostname(hostname: string): string | null {
  const host = hostname.split(':')[0].toLowerCase();

  // localhost / IP — no subdomain
  if (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;

  const parts = host.split('.');
  // Need at least subdomain.domain.tld
  if (parts.length < 3) return null;

  const subdomain = parts[0];
  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) return null;

  return subdomain;
}

export function getPlatformBaseDomain(): string | null {
  if (typeof window === 'undefined') return null;
  const parts = window.location.hostname.split('.');
  if (parts.length < 2) return null;
  return parts.slice(-2).join('.');
}
