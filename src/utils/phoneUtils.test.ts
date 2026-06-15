import { describe, it, expect } from 'vitest';
import { normalizePhoneInput, isValidIraqiPhone, formatPhoneForStorage } from '@/utils/phoneUtils';

describe('phoneUtils', () => {
  it('normalizes Arabic digits and +964 prefix', () => {
    expect(normalizePhoneInput('٠٧٧٠١٢٣٤٥٦٧')).toBe('07701234567');
    expect(normalizePhoneInput('+964 770 123 4567')).toBe('07701234567');
  });

  it('validates Iraqi mobile numbers', () => {
    expect(isValidIraqiPhone('07701234567')).toBe(true);
    expect(isValidIraqiPhone('123')).toBe(false);
  });

  it('formats phone for storage', () => {
    expect(formatPhoneForStorage('0770 123 4567')).toBe('07701234567');
  });
});
