const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Normalize Iraqi phone input (Arabic digits, +964, spaces). */
export function normalizePhoneInput(phone: string): string {
  let value = phone.trim();
  for (let i = 0; i < 10; i++) {
    value = value.replace(new RegExp(ARABIC_DIGITS[i], 'g'), String(i));
  }
  value = value.replace(/[\s\-().]/g, '');
  if (value.startsWith('+964')) value = `0${value.slice(4)}`;
  else if (value.startsWith('964')) value = `0${value.slice(3)}`;
  else if (value.startsWith('7') && value.length === 10) value = `0${value}`;
  return value;
}

export function isValidIraqiPhone(phone: string): boolean {
  const normalized = normalizePhoneInput(phone);
  return /^07\d{9}$/.test(normalized);
}

export function formatPhoneForStorage(phone: string): string {
  return normalizePhoneInput(phone);
}
