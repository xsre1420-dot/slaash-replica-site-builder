
/**
 * Suggestion #1: Validate image URLs before saving product
 * Suggestion #5: Auto-retry broken images with re-upload button
 */

import { isBlobUrl } from './imageUpload';

const TRUSTED_STORAGE_PATTERN = /\/storage\/v1\/object\/public\/product-images\//;

/** Uploaded Supabase storage URLs — skip slow/flaky network probes before save */
export const isTrustedProductImageUrl = (url: string): boolean =>
  !!url && !isBlobUrl(url) && TRUSTED_STORAGE_PATTERN.test(url);

/**
 * Check if an image URL is valid and accessible
 */
export const validateImageUrl = (url: string): Promise<boolean> => {
  if (isTrustedProductImageUrl(url)) return Promise.resolve(true);
  return new Promise((resolve) => {
    if (!url || url.trim() === '') {
      resolve(false);
      return;
    }

    // Blob URLs are temporary and won't persist
    if (isBlobUrl(url)) {
      resolve(false);
      return;
    }

    // Check if it's a valid URL format
    try {
      new URL(url);
    } catch {
      resolve(false);
      return;
    }

    // Try loading the image
    const img = new Image();
    const timeout = setTimeout(() => {
      img.src = '';
      resolve(false);
    }, 8000);

    img.onload = () => {
      clearTimeout(timeout);
      resolve(true);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };

    img.src = url;
  });
};

/**
 * Validate all product images before saving
 * Returns { valid: boolean, invalidUrls: string[] }
 */
export const validateProductImages = async (
  mainImage: string | null,
  additionalImages: string[]
): Promise<{ valid: boolean; invalidUrls: string[]; hasBlobUrls: boolean }> => {
  const invalidUrls: string[] = [];
  let hasBlobUrls = false;

  const allImages = [
    ...(mainImage ? [mainImage] : []),
    ...additionalImages,
  ];

  // Check for blob URLs first (fast check)
  for (const url of allImages) {
    if (isBlobUrl(url)) {
      hasBlobUrls = true;
      invalidUrls.push(url);
    }
  }

  // Trusted storage URLs + optional network check for external URLs only
  if (!hasBlobUrls) {
    await Promise.all(
      allImages.map(async (url) => {
        if (isTrustedProductImageUrl(url)) return;
        const isValid = await validateImageUrl(url);
        if (!isValid) invalidUrls.push(url);
      })
    );
  }

  return {
    valid: invalidUrls.length === 0,
    invalidUrls,
    hasBlobUrls,
  };
};

/**
 * Check if a single image is broken (404/error)
 */
export const isImageBroken = async (url: string): Promise<boolean> => {
  if (!url || isBlobUrl(url)) return true;
  const isValid = await validateImageUrl(url);
  return !isValid;
};
