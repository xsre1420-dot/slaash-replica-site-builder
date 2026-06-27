/** Supabase Storage media helpers — URL parsing, reference tracking, integrity checks. */

export const STORAGE_BUCKET = 'product-images';

const STORAGE_PATH_RE =
  /^[0-9a-f-]{36}\/(([0-9a-f-]{36}\.(webp|jpg|jpeg|png))|(thumbs\/[0-9a-f-]{36}\.(webp|jpg|jpeg|png)))$/i;

/** Parse `{ownerId}/{file}` from a Supabase public storage URL. */
export const parseStorageObjectPath = (publicUrl: string): string | null => {
  if (!publicUrl?.trim()) return null;
  try {
    const url = new URL(publicUrl.trim());
    const marker = `/object/public/${STORAGE_BUCKET}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return null;
    const path = decodeURIComponent(url.pathname.slice(idx + marker.length));
    return isValidStorageObjectPath(path) ? path : null;
  } catch {
    return null;
  }
};

export const isValidStorageObjectPath = (path: string): boolean => STORAGE_PATH_RE.test(path);

export const isOurStorageUrl = (url: string): boolean => parseStorageObjectPath(url) != null;

export const thumbPathFor = (objectPath: string): string | null => {
  const match = objectPath.match(/^([^/]+)\/([0-9a-f-]{36}\.(webp|jpg|jpeg|png))$/i);
  if (!match) return null;
  return `${match[1]}/thumbs/${match[2]}`;
};

export const collectUrlsFromFields = (
  values: Array<string | null | undefined | string[]>
): string[] => {
  const urls = new Set<string>();
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item?.trim()) urls.add(item.trim());
      }
    } else if (value?.trim()) {
      urls.add(value.trim());
    }
  }
  return [...urls];
};

export const collectProductImageUrls = (row: {
  image_url?: string | null;
  additional_images?: string[] | null;
  image?: string | null;
  additionalImages?: string[] | null;
}): string[] =>
  collectUrlsFromFields([
    row.image_url ?? row.image,
    row.additional_images ?? row.additionalImages,
  ]);

export const collectStoreBrandingUrls = (row: {
  store_logo?: string | null;
  storeLogo?: string | null;
  banner_images?: string[] | null;
  bannerImages?: string[] | null;
}): string[] =>
  collectUrlsFromFields([
    row.store_logo ?? row.storeLogo,
    row.banner_images ?? row.bannerImages,
  ]);

/** URLs present in `before` but not in `after` (storage URLs only). */
export const diffRemovedStorageUrls = (before: string[], after: string[]): string[] => {
  const afterSet = new Set(after.filter(isOurStorageUrl));
  return before.filter((url) => isOurStorageUrl(url) && !afterSet.has(url));
};

/** Object paths referenced by public URLs (includes companion thumbnails). */
export const pathsFromUrls = (urls: string[]): Set<string> => {
  const paths = new Set<string>();
  for (const url of urls) {
    const objectPath = parseStorageObjectPath(url);
    if (!objectPath) continue;
    paths.add(objectPath);
    const thumb = thumbPathFor(objectPath);
    if (thumb) paths.add(thumb);
  }
  return paths;
};

/** Storage object paths with no DB reference. */
export const findOrphanObjectPaths = (
  bucketPaths: string[],
  referencedUrls: string[]
): string[] => {
  const referenced = pathsFromUrls(referencedUrls);
  return bucketPaths.filter((path) => isValidStorageObjectPath(path) && !referenced.has(path));
};

/** Duplicate URL references across a merchant's media set. */
export const findDuplicateUrlReferences = (urls: string[]): string[] => {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const url of urls) {
    if (!isOurStorageUrl(url)) continue;
    if (seen.has(url)) dupes.add(url);
    seen.add(url);
  }
  return [...dupes];
};
