/** Admin-only session cache for plaintext access codes (shown once at generation; not stored in DB). */

const STORAGE_KEY = 'slaash_admin_access_codes_v1';
const MAX_ENTRIES = 200;

export type StoredAccessCode = {
  leadId: string;
  codeId: string;
  accessCode: string;
  createdAt: string;
};

function readAll(): StoredAccessCode[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredAccessCode[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries: StoredAccessCode[]): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* quota — best effort */
  }
}

/** Persist plaintext code for copy/resend on the lead detail page (same browser session). */
export function saveGeneratedAccessCode(entry: StoredAccessCode): void {
  const entries = readAll().filter(
    (row) => !(row.leadId === entry.leadId && row.codeId === entry.codeId)
  );
  entries.unshift(entry);
  writeAll(entries);
}

export function getStoredAccessCodeForLead(leadId: string, codeId?: string): string | null {
  const entries = readAll().filter((row) => row.leadId === leadId);
  if (codeId) {
    return entries.find((row) => row.codeId === codeId)?.accessCode ?? null;
  }
  return entries[0]?.accessCode ?? null;
}

export function clearStoredAccessCodesForLead(leadId: string): void {
  writeAll(readAll().filter((row) => row.leadId !== leadId));
}
