/** Matches DB constraint: 3–30 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphen */
export const STORE_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export function normalizeStoreSlugInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

export function validateStoreSlug(slug: string): string | null {
  const normalized = normalizeStoreSlugInput(slug.trim());
  if (!normalized) return 'رابط المتجر مطلوب';
  if (normalized.length < 3) return 'رابط المتجر يجب أن يكون 3 أحرف على الأقل';
  if (!STORE_SLUG_REGEX.test(normalized)) {
    return 'رابط المتجر: 3-30 حرف، أحرف إنجليزية صغيرة وأرقام و - فقط، بدون شرطة في البداية أو النهاية';
  }
  return null;
}
