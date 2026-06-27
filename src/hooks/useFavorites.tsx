import { useState, useEffect, useCallback } from "react";

const favoritesKey = (storeSlug?: string) =>
  storeSlug ? `store_favorites:${storeSlug.trim().toLowerCase()}` : "store_favorites";

export function useFavorites(storeSlug?: string) {
  const storageKey = favoritesKey(storeSlug);

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setFavorites(stored ? JSON.parse(stored) : []);
    } catch {
      setFavorites([]);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(favorites));
    } catch {}
  }, [favorites, storageKey]);

  const toggleFavorite = useCallback((productId: string) => {
    setFavorites(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  }, []);

  const isFavorite = useCallback((productId: string) => favorites.includes(productId), [favorites]);

  return { favorites, toggleFavorite, isFavorite, count: favorites.length };
}
