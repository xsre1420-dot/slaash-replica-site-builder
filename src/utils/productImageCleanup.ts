import { deleteImage } from '@/utils/imageUpload';
import {
  collectProductImageUrls,
  collectStoreBrandingUrls,
  diffRemovedStorageUrls,
  isOurStorageUrl,
} from '@/utils/storageMediaUtils';

export { collectProductImageUrls, collectStoreBrandingUrls } from '@/utils/storageMediaUtils';

/** Best-effort storage cleanup after product removal (non-blocking failures). */
export const deleteProductStorageImages = async (urls: string[]): Promise<void> => {
  const storageUrls = urls.filter(isOurStorageUrl);
  if (storageUrls.length === 0) return;
  await Promise.allSettled(storageUrls.map((url) => deleteImage(url)));
};

/** Delete images removed during a product update (after DB save succeeds). */
export const cleanupRemovedProductImages = async (
  previousRow: Parameters<typeof collectProductImageUrls>[0],
  nextRow: Parameters<typeof collectProductImageUrls>[0]
): Promise<void> => {
  const removed = diffRemovedStorageUrls(
    collectProductImageUrls(previousRow),
    collectProductImageUrls(nextRow)
  );
  await deleteProductStorageImages(removed);
};

/** Delete branding URLs no longer referenced in store settings. */
export const cleanupRemovedBrandingImages = async (
  previous: Parameters<typeof collectStoreBrandingUrls>[0],
  next: Parameters<typeof collectStoreBrandingUrls>[0]
): Promise<void> => {
  const removed = diffRemovedStorageUrls(
    collectStoreBrandingUrls(previous),
    collectStoreBrandingUrls(next)
  );
  await deleteProductStorageImages(removed);
};
