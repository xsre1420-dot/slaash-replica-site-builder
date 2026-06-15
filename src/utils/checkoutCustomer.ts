export interface CheckoutCustomerInfo {
  name: string;
  phone: string;
  address: string;
  notes: string;
  governorate?: string;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const sessionKey = (ownerId: string) => `checkout-customer:${ownerId}`;
const backupKey = (ownerId: string) => `checkout-customer:${ownerId}:backup`;

function parseCustomer(raw: string): CheckoutCustomerInfo | null {
  try {
    const parsed = JSON.parse(raw) as Partial<CheckoutCustomerInfo> & { expiresAt?: number };
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.expiresAt != null && parsed.expiresAt < Date.now()) return null;
    return {
      name: String(parsed.name || ''),
      phone: String(parsed.phone || ''),
      address: String(parsed.address || ''),
      notes: String(parsed.notes || ''),
      governorate: parsed.governorate ? String(parsed.governorate) : undefined,
    };
  } catch {
    return null;
  }
}

export function loadCheckoutCustomer(ownerId: string): CheckoutCustomerInfo | null {
  if (!ownerId) return null;

  try {
    const fromSession = sessionStorage.getItem(sessionKey(ownerId));
    if (fromSession) {
      const parsed = parseCustomer(fromSession);
      if (parsed) return parsed;
    }

    const fromBackup = localStorage.getItem(backupKey(ownerId));
    if (fromBackup) {
      const parsed = parseCustomer(fromBackup);
      if (parsed) {
        sessionStorage.setItem(sessionKey(ownerId), fromBackup);
        return parsed;
      }
      localStorage.removeItem(backupKey(ownerId));
    }
  } catch {
    /* ignore quota / parse errors */
  }

  return null;
}

export function saveCheckoutCustomer(ownerId: string, info: CheckoutCustomerInfo): void {
  if (!ownerId) return;

  const payload = JSON.stringify({
    ...info,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  try {
    sessionStorage.setItem(sessionKey(ownerId), payload);
    localStorage.setItem(backupKey(ownerId), payload);
  } catch {
    /* ignore quota errors */
  }
}
