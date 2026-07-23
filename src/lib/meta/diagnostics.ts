import type { MetaDiagnosticEntry, MetaPixelRuntimeState } from '@/lib/meta/types';

const MAX_ENTRIES = 100;
const STORAGE_KEY = 'meta_diagnostics_v1';

let entries: MetaDiagnosticEntry[] = [];
let runtimeState: MetaPixelRuntimeState = {
  loaded: false,
  pixelId: null,
  ownerId: null,
  marketingEnabled: false,
  browserEventsEnabled: true,
  debugMode: false,
  lastPageViewPath: null,
  scriptInjected: false,
};

const listeners = new Set<() => void>();

function persistIfDebug(): void {
  if (!runtimeState.debugMode || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ entries, runtimeState }));
  } catch {
    /* quota */
  }
}

function loadPersisted(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { entries?: MetaDiagnosticEntry[]; runtimeState?: MetaPixelRuntimeState };
    if (parsed.entries) entries = parsed.entries.slice(0, MAX_ENTRIES);
    if (parsed.runtimeState) runtimeState = { ...runtimeState, ...parsed.runtimeState };
  } catch {
    /* ignore */
  }
}

loadPersisted();

export function subscribeMetaDiagnostics(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  listeners.forEach((l) => l());
}

export function updateMetaRuntimeState(patch: Partial<MetaPixelRuntimeState>): void {
  runtimeState = { ...runtimeState, ...patch };
  persistIfDebug();
  notify();
}

export function getMetaRuntimeState(): MetaPixelRuntimeState {
  return { ...runtimeState };
}

export function recordMetaDiagnostic(entry: Omit<MetaDiagnosticEntry, 'id' | 'timestamp'>): void {
  const full: MetaDiagnosticEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
  };
  entries = [full, ...entries].slice(0, MAX_ENTRIES);

  if (runtimeState.debugMode && typeof console !== 'undefined') {
    const label = `[Meta ${entry.channel}] ${entry.eventName}`;
    if (entry.success) console.info(label, full);
    else console.warn(label, full);
  }

  persistIfDebug();
  notify();
}

export function getMetaDiagnostics(): MetaDiagnosticEntry[] {
  return [...entries];
}

export function clearMetaDiagnostics(): void {
  entries = [];
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  notify();
}
