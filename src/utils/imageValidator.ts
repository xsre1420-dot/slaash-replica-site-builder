
/**
 * Suggestion #1: Validate image URLs before saving product
 * Suggestion #5: Auto-retry broken images with re-upload button
 */

import { isBlobUrl } from './imageUpload';

/**
 * Check if an image URL is valid and accessible
 */
export const validateImageUrl = (url: string): Promise<boolean> => {
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

  // If no blob URLs, validate all URLs in parallel
  if (!hasBlobUrls) {
    const results = await Promise.allSettled(
      allImages.map(async (url) => {
        const isValid = await validateImageUrl(url);
        if (!isValid) invalidUrls.push(url);
        return isValid;
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
