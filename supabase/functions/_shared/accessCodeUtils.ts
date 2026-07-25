const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const normalizeAccessCode = (code: string): string =>
  code
    .replace(/[\u200B-\u200D\uFEFF\u2066-\u2069]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();

const ACCESS_CODE_COMPACT_PATTERN = /BDY[A-HJ-NP-Z2-9]{8}/;

/** Extract BDY + 8 chars even when paste includes extra text (WhatsApp blocks, RTL). */
export const extractAccessCodeCompact = (code: string): string | null => {
  const compact = normalizeAccessCode(code);
  const match = compact.match(ACCESS_CODE_COMPACT_PATTERN);
  if (match) return match[0];
  if (compact.startsWith('BDY') && compact.length >= 11) {
    return compact.slice(0, 11);
  }
  return null;
};

export const resolveAccessCodeForHash = (code: string): string => {
  const extracted = extractAccessCodeCompact(code);
  if (extracted) return extracted;
  return normalizeAccessCode(code);
};

export const formatAccessCode = (raw: string): string => {
  const n = extractAccessCodeCompact(raw) ?? normalizeAccessCode(raw);
  if (n.length !== 11 || !n.startsWith('BDY')) return raw.toUpperCase();
  return `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7, 11)}`;
};

export const generateAccessCode = (): string => {
  const part = (len: number) =>
    Array.from({ length: len }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  return `BDY-${part(4)}-${part(4)}`;
};

const digestSha256Hex = async (value: string): Promise<string> => {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const hashAccessCode = async (code: string): Promise<string> =>
  digestSha256Hex(resolveAccessCodeForHash(code));

/** Legacy SQL path: hash full normalized string (pre extract BDY+8 alignment). */
export const hashAccessCodeLegacy = async (code: string): Promise<string> =>
  digestSha256Hex(normalizeAccessCode(code));

/** Candidate hashes for DB lookup — canonical first, then legacy normalize. */
export const accessCodeHashCandidates = async (code: string): Promise<string[]> => {
  const canonical = resolveAccessCodeForHash(code);
  const legacy = normalizeAccessCode(code);
  const hashes = [await hashAccessCode(canonical)];
  if (legacy !== canonical) {
    hashes.push(await digestSha256Hex(legacy));
  }
  return [...new Set(hashes)];
};

export const generateAuthPassword = (): string => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

export const generateUsername = (): string => {
  const suffix = Math.floor(10000 + Math.random() * 90000);
  return `store${suffix}`;
};

export const planDurationMonths = (planId: string): number => (planId === 'yearly' ? 12 : 6);

export const addMonths = (date: Date, months: number): Date => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};
