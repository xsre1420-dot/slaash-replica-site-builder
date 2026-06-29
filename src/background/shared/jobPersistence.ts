/**
 * IndexedDB persistence for pending client jobs — crash recovery across refresh.
 */
import type { BackgroundJob } from '@/background/shared/types';

const DB_NAME = 'bidaya-background-jobs';
const DB_VERSION = 1;
const STORE = 'pending';
const MAX_PERSISTED = 100;

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });

export async function persistPendingJobs(jobs: BackgroundJob[]): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.clear();
    for (const job of jobs.slice(0, MAX_PERSISTED)) {
      if (job.status === 'pending' || job.status === 'processing') {
        store.put({ ...job, status: 'pending' as const });
      }
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* best-effort */
  }
}

export async function restorePendingJobs(): Promise<BackgroundJob[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    const rows = await new Promise<BackgroundJob[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as BackgroundJob[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    return rows.filter((j) => j.status === 'pending' || j.status === 'processing');
  } catch {
    return [];
  }
}

export async function clearPersistedJobsForTests(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}
