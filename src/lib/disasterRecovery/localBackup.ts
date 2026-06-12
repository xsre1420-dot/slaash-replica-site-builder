import { DR_STORAGE_KEYS } from './config';
import { getQueuedOperations } from '@/utils/indexedDB';

export interface LocalBackupSnapshot {
  version: string;
  exportedAt: string;
  sessionStorage: Record<string, string>;
  localStorage: Record<string, string>;
  offlineQueueCount: number;
}

const BACKUP_PREFIXES = ['cart:', 'checkout-', 'obs:', 'dr:'];

const collectStorage = (storage: Storage): Record<string, string> => {
  const out: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    if (BACKUP_PREFIXES.some((p) => key.includes(p))) {
      const value = storage.getItem(key);
      if (value != null) out[key] = value;
    }
  }
  return out;
};

export const exportLocalBackup = async (): Promise<LocalBackupSnapshot> => {
  const queue = await getQueuedOperations();
  return {
    version: DR_STORAGE_KEYS.LOCAL_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sessionStorage: collectStorage(sessionStorage),
    localStorage: collectStorage(localStorage),
    offlineQueueCount: queue.length,
  };
};

export const downloadLocalBackup = async (): Promise<void> => {
  const snapshot = await exportLocalBackup();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `local-backup-${snapshot.exportedAt.replace(/[:.]/g, '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const restoreLocalBackup = (snapshot: LocalBackupSnapshot): { restored: number; skipped: number } => {
  if (snapshot.version !== DR_STORAGE_KEYS.LOCAL_BACKUP_VERSION) {
    throw new Error('Unsupported backup version');
  }

  let restored = 0;
  let skipped = 0;

  Object.entries(snapshot.sessionStorage).forEach(([key, value]) => {
    try {
      sessionStorage.setItem(key, value);
      restored++;
    } catch {
      skipped++;
    }
  });

  Object.entries(snapshot.localStorage).forEach(([key, value]) => {
    try {
      localStorage.setItem(key, value);
      restored++;
    } catch {
      skipped++;
    }
  });

  return { restored, skipped };
};

export const importLocalBackupFromFile = (file: File): Promise<{ restored: number; skipped: number }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const snapshot = JSON.parse(String(reader.result)) as LocalBackupSnapshot;
        resolve(restoreLocalBackup(snapshot));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
