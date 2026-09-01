/** Shared tenant-store inflight promises — avoids circular imports with bundle coordinator. */
const inflightBySlug = new Map<string, Promise<void>>();

export function getTenantStoreInflight(slug: string): Promise<void> | null {
  const normalized = slug.trim().toLowerCase();
  return inflightBySlug.get(normalized) ?? null;
}

export function setTenantStoreInflight(slug: string, task: Promise<void> | null): void {
  const normalized = slug.trim().toLowerCase();
  if (task === null) {
    inflightBySlug.delete(normalized);
  } else {
    inflightBySlug.set(normalized, task);
  }
}
