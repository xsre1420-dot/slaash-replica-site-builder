/** Matches DB constraint: 3–30 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphen */
export const STORE_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export function normalizeStoreSlugInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

/** Build a valid store slug from username/email (matches DB provisioning logic). */
export function slugifyUsernameForStore(username: string): string {
  let slug = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length < 3) {
    slug = `${slug}${slug ? '-' : ''}store`;
  }

  if (slug.length > 30) {
    slug = slug.slice(0, 30).replace(/-+$/g, '');
  }

  if (!STORE_SLUG_REGEX.test(slug)) {
    slug = `store-${slug}`.slice(0, 30).replace(/-+$/g, '');
  }

  return slug;
}

export function withStoreSlugSuffix(baseSlug: string, suffix: number): string {
  const suffixText = suffix > 1 ? `-${suffix}` : '';
  const trimmedBase = baseSlug.slice(0, Math.max(3, 30 - suffixText.length)).replace(/-+$/g, '');
  const candidate = `${trimmedBase}${suffixText}`;
  return STORE_SLUG_REGEX.test(candidate) ? candidate : slugifyUsernameForStore(candidate);
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
