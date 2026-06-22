const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const normalizeAccessCode = (code: string): string =>
  code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

export const formatAccessCode = (raw: string): string => {
  const n = normalizeAccessCode(raw);
  if (n.length !== 11 || !n.startsWith('BDY')) return raw.toUpperCase();
  return `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7, 11)}`;
};

export const generateAccessCode = (): string => {
  const part = (len: number) =>
    Array.from({ length: len }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  return `BDY-${part(4)}-${part(4)}`;
};

export const hashAccessCode = async (code: string): Promise<string> => {
  const normalized = normalizeAccessCode(code);
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
