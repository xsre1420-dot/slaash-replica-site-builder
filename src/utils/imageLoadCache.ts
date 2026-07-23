/** Tracks URLs that finished loading in this tab — avoids duplicate decode / flicker on remount. */
const loadedUrls = new Set<string>();

export function markImageUrlLoaded(url: string): void {
  const trimmed = url?.trim();
  if (trimmed) loadedUrls.add(trimmed);
}

export function isImageUrlLoaded(url: string): boolean {
  const trimmed = url?.trim();
  return trimmed ? loadedUrls.has(trimmed) : false;
}

export function clearImageLoadCacheForTests(): void {
  loadedUrls.clear();
}
