/** Shared Meta Conversions API helpers (Deno edge + tests). */

export const META_API_VERSION = 'v21.0';

export async function sha256Hex(value: string): Promise<string> {
  const normalized = value.trim().toLowerCase();
  const data = new TextEncoder().encode(normalized);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Phone(value: string): Promise<string> {
  const normalized = value.trim().toLowerCase().replace(/\D/g, '');
  return sha256Hex(normalized);
}

/** Split full name into first / last tokens (existing checkout data only). */
export function splitCustomerName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export interface MetaCapiUserDataInput {
  clientIp?: string;
  userAgent?: string;
  fbp?: string | null;
  fbc?: string | null;
  phone?: string | null;
  email?: string | null;
  externalId?: string | null;
  customerName?: string | null;
  governorate?: string | null;
}

export async function buildMetaUserData(input: MetaCapiUserDataInput): Promise<Record<string, unknown>> {
  const userData: Record<string, unknown> = {};
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.userAgent) userData.client_user_agent = input.userAgent;
  if (input.fbp?.trim()) userData.fbp = input.fbp.trim();
  if (input.fbc?.trim()) userData.fbc = input.fbc.trim();
  if (input.phone?.trim()) userData.ph = [await sha256Phone(input.phone)];
  if (input.email?.trim()) userData.em = [await sha256Hex(input.email.trim().toLowerCase())];
  if (input.externalId?.trim()) userData.external_id = [await sha256Hex(input.externalId.trim())];

  if (input.customerName?.trim()) {
    const { firstName, lastName } = splitCustomerName(input.customerName);
    if (firstName) userData.fn = [await sha256Hex(firstName)];
    if (lastName) userData.ln = [await sha256Hex(lastName)];
  }
  if (input.governorate?.trim()) userData.st = [await sha256Hex(input.governorate.trim())];

  return userData;
}

export interface MetaCapiEventInput {
  eventName: string;
  eventId: string;
  eventTime?: number;
  eventSourceUrl?: string | null;
  actionSource?: string;
  customData?: Record<string, unknown>;
  userData?: Record<string, unknown>;
}

export function buildMetaCapiPayload(
  events: MetaCapiEventInput[],
  testEventCode?: string | null
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    data: events.map((ev) => ({
      event_name: ev.eventName,
      event_time: ev.eventTime ?? Math.floor(Date.now() / 1000),
      event_id: ev.eventId,
      action_source: ev.actionSource ?? 'website',
      event_source_url: ev.eventSourceUrl || undefined,
      user_data: ev.userData ?? {},
      custom_data: ev.customData ?? {},
    })),
  };
  const code = testEventCode?.trim();
  if (code) payload.test_event_code = code;
  return payload;
}

export function metaMatchQualityHints(userData: Record<string, unknown>): string[] {
  const hints: string[] = [];
  if (userData.client_ip_address) hints.push('client_ip');
  if (userData.client_user_agent) hints.push('user_agent');
  if (userData.fbp) hints.push('fbp');
  if (userData.fbc) hints.push('fbc');
  if (userData.ph) hints.push('phone_hashed');
  if (userData.em) hints.push('email_hashed');
  if (userData.external_id) hints.push('external_id_hashed');
  if (userData.fn) hints.push('first_name_hashed');
  if (userData.ln) hints.push('last_name_hashed');
  if (userData.st) hints.push('state_hashed');
  if (userData.ct) hints.push('city_hashed');
  if (userData.country) hints.push('country_hashed');
  return hints;
}
