
/**
 * Suggestion #9: IndexedDB cache for instant load
 * Suggestion #10: Save skeleton dimensions
 */

const DB_NAME = 'bidaya-store-cache';
const DB_VERSION = 1;

interface CachedData<T> {
  key: string;
  data: T;
  timestamp: number;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('dimensions')) {
        db.createObjectStore('dimensions', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('offlineQueue')) {
        db.createObjectStore('offlineQueue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

export const cacheSet = async <T>(key: string, data: T): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction('cache', 'readwrite');
    const store = tx.objectStore('cache');
    store.put({ key, data, timestamp: Date.now() } as CachedData<T>);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('IndexedDB cacheSet failed:', e);
  }
};

export const cacheGet = async <T>(key: string, maxAge?: number): Promise<T | null> => {
  try {
    const db = await openDB();
    const tx = db.transaction('cache', 'readonly');
    const store = tx.objectStore('cache');
    const request = store.get(key);
    
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const result = request.result as CachedData<T> | undefined;
        if (!result) { resolve(null); return; }
        if (maxAge && Date.now() - result.timestamp > maxAge) { resolve(null); return; }
        resolve(result.data);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

// Suggestion #10: Skeleton dimensions
export const saveDimensions = async (key: string, dimensions: { width: number; height: number; count: number }): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction('dimensions', 'readwrite');
    tx.objectStore('dimensions').put({ key, ...dimensions });
  } catch {}
};

export const getDimensions = async (key: string): Promise<{ width: number; height: number; count: number } | null> => {
  try {
    const db = await openDB();
    const tx = db.transaction('dimensions', 'readonly');
    const request = tx.objectStore('dimensions').get(key);
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

// Suggestion #12: Offline operation queue
export interface QueuedOperation {
  id?: number;
  type: 'insert' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: number;
}

export const addToQueue = async (op: Omit<QueuedOperation, 'id' | 'timestamp'>): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction('offlineQueue', 'readwrite');
    tx.objectStore('offlineQueue').add({ ...op, timestamp: Date.now() });
  } catch (e) {
    console.warn('Failed to queue operation:', e);
  }
};

export const getQueuedOperations = async (): Promise<QueuedOperation[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction('offlineQueue', 'readonly');
    const request = tx.objectStore('offlineQueue').getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
};

export const clearQueue = async (): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction('offlineQueue', 'readwrite');
    tx.objectStore('offlineQueue').clear();
  } catch {}
};

export const removeFromQueue = async (id: number): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction('offlineQueue', 'readwrite');
    tx.objectStore('offlineQueue').delete(id);
  } catch {}
};
