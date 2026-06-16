/** Persist tenant store slug so checkout works after /checkout redirects. */

const slugKey = (ownerId: string) => `checkout-store-slug:${ownerId}`;

export const persistCheckoutStoreSlug = (ownerId: string, storeSlug: string): void => {
  if (!ownerId || !storeSlug?.trim()) return;
  try {
    sessionStorage.setItem(slugKey(ownerId), storeSlug.trim().toLowerCase());
  } catch {
    /* ignore quota */
  }
};

export const loadCheckoutStoreSlug = (ownerId: string): string | null => {
  if (!ownerId) return null;
  try {
    return sessionStorage.getItem(slugKey(ownerId));
  } catch {
    return null;
  }
};
