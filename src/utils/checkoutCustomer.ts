export interface CheckoutCustomerInfo {
  name: string;
  phone: string;
  address: string;
  notes: string;
  governorate?: string;
}

const storageKey = (ownerId: string) => `checkout-customer:${ownerId}`;

export function loadCheckoutCustomer(ownerId: string): CheckoutCustomerInfo | null {
  try {
    const raw = sessionStorage.getItem(storageKey(ownerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CheckoutCustomerInfo>;
    if (!parsed || typeof parsed !== 'object') return null;
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

export function saveCheckoutCustomer(ownerId: string, info: CheckoutCustomerInfo): void {
  try {
    sessionStorage.setItem(storageKey(ownerId), JSON.stringify(info));
  } catch {
    /* ignore quota errors */
  }
}
