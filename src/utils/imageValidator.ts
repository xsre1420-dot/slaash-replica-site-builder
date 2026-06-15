
/**
 * Image validation before product save — blocks only temporary blob URLs.
 * Uploaded Supabase URLs are trusted (upload already succeeded).
 */

import { isBlobUrl } from './imageUpload';

const STORAGE_URL_PATTERN = /product-images/i;

/** Uploaded storage URL (Supabase public bucket) */
export const isTrustedProductImageUrl = (url: string): boolean => {
  if (!url || isBlobUrl(url)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return STORAGE_URL_PATTERN.test(url);
  }
};

export const validateImageUrl = (url: string): Promise<boolean> => {
  if (isTrustedProductImageUrl(url)) return Promise.resolve(true);
  return Promise.resolve(false);
};

/**
 * Validate product images before saving.
 * Only rejects blob: URLs (upload not finished) or empty URLs.
 */
export const validateProductImages = async (
  mainImage: string | null,
  additionalImages: string[]
): Promise<{ valid: boolean; invalidUrls: string[]; hasBlobUrls: boolean }> => {
  if (!mainImage?.trim()) {
    return { valid: false, invalidUrls: [], hasBlobUrls: false };
  }

  const allImages = [mainImage, ...additionalImages];
  const invalidUrls = allImages.filter((url) => !url?.trim() || isBlobUrl(url));
  const hasBlobUrls = invalidUrls.some(isBlobUrl);

  return {
    valid: invalidUrls.length === 0,
    invalidUrls,
    hasBlobUrls,
  };
};

export const isImageBroken = async (url: string): Promise<boolean> => {
  if (!url || isBlobUrl(url)) return true;
  return !isTrustedProductImageUrl(url);
};
