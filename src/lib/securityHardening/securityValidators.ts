/**
 * Security validators — CSRF, redirects, uploads, mass assignment (no behavior change until wired).
 */
const CSRF_TOKEN_KEY = '__csrf_token';

export function generateCsrfToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function storeCsrfToken(token: string): void {
  try {
    sessionStorage.setItem(CSRF_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function validateCsrfToken(submitted: string | null | undefined): boolean {
  if (!submitted) return false;
  try {
    const stored = sessionStorage.getItem(CSRF_TOKEN_KEY);
    return !!stored && stored === submitted && submitted.length >= 32;
  } catch {
    return false;
  }
}

export function isSafeRedirectUrl(url: string, allowedOrigins?: string[]): boolean {
  if (!url || url.startsWith('//')) return false;
  if (url.startsWith('/') && !url.startsWith('//')) {
    return !url.toLowerCase().startsWith('/\\') && !url.includes('\0');
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (allowedOrigins && allowedOrigins.length > 0) {
      return allowedOrigins.some((o) => parsed.origin === o.replace(/\/$/, ''));
    }
    if (typeof window !== 'undefined') {
      return parsed.origin === window.location.origin;
    }
    return false;
  } catch {
    return false;
  }
}

export const DEFAULT_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type UploadValidationResult = { valid: boolean; reason?: string };

export function validateUploadFile(
  file: { name: string; type: string; size: number },
  options: {
    allowedMimeTypes?: readonly string[];
    maxBytes?: number;
  } = {}
): UploadValidationResult {
  const allowed = options.allowedMimeTypes ?? DEFAULT_UPLOAD_MIME_TYPES;
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;

  if (file.size <= 0) return { valid: false, reason: 'empty_file' };
  if (file.size > maxBytes) return { valid: false, reason: 'file_too_large' };
  if (!allowed.includes(file.type)) return { valid: false, reason: 'invalid_mime_type' };

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const dangerousExt = ['exe', 'bat', 'cmd', 'sh', 'php', 'js', 'html', 'svg'];
  if (dangerousExt.includes(ext)) return { valid: false, reason: 'dangerous_extension' };

  return { valid: true };
}

export function stripUnknownKeys<T extends Record<string, unknown>>(
  payload: T,
  allowedKeys: readonly string[]
): Partial<T> {
  const allowed = new Set(allowedKeys);
  const out: Partial<T> = {};
  for (const key of Object.keys(payload)) {
    if (allowed.has(key)) {
      out[key as keyof T] = payload[key as keyof T];
    }
  }
  return out;
}

export function resetCsrfForTests(): void {
  try {
    sessionStorage.removeItem(CSRF_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
