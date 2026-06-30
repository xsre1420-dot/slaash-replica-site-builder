/**
 * Stateless worker identity — each app instance gets a stable ID per session.
 * Used for metrics and distributed job claim visibility; no leader election.
 */
const STORAGE_KEY = 'platform_worker_instance_id';

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `w-${crypto.randomUUID().slice(0, 12)}`;
  }
  return `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

let memoryId: string | null = null;

export function getWorkerInstanceId(): string {
  if (memoryId) return memoryId;

  if (typeof sessionStorage !== 'undefined') {
    try {
      const existing = sessionStorage.getItem(STORAGE_KEY);
      if (existing) {
        memoryId = existing;
        return existing;
      }
      const created = generateId();
      sessionStorage.setItem(STORAGE_KEY, created);
      memoryId = created;
      return created;
    } catch {
      /* private browsing / quota */
    }
  }

  memoryId = generateId();
  return memoryId;
}

/** @internal test helper */
export function resetWorkerInstanceIdForTests(): void {
  memoryId = null;
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
