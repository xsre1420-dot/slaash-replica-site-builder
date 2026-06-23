import { deleteImage } from '@/utils/imageUpload';

export const collectProductImageUrls = (row: {
  image_url?: string | null;
  additional_images?: string[] | null;
}): string[] => {
  const urls = new Set<string>();
  if (row.image_url?.trim()) urls.add(row.image_url.trim());
  for (const url of row.additional_images ?? []) {
    if (url?.trim()) urls.add(url.trim());
  }
  return [...urls];
};

/** Best-effort storage cleanup after product removal (non-blocking failures). */
export const deleteProductStorageImages = async (urls: string[]): Promise<void> => {
  if (urls.length === 0) return;
  await Promise.allSettled(urls.map((url) => deleteImage(url)));
};
