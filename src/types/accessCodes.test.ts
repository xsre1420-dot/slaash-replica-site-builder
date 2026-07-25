import { describe, expect, it } from 'vitest';
import {
  extractAccessCodeCompact,
  formatAccessCodeForSubmit,
  formatAccessCodeInput,
  parseAccessCodePaste,
} from '@/types/accessCodes';

describe('access code parsing', () => {
  const sample = 'BDY-ABCD-EFGH';

  it('extracts code from WhatsApp-style paste with extra text', () => {
    const messy =
      'مرحباً 👋\n🔑 *رمز الدخول للمنصة:*\nBDY-ABCD-EFGH\n\nادخل من الرابط';
    expect(formatAccessCodeForSubmit(messy)).toBe('BDY-ABCD-EFGH');
  });

  it('ignores leading junk before BDY', () => {
    expect(formatAccessCodeForSubmit('loginBDY-ABCD-EFGH')).toBe('BDY-ABCD-EFGH');
  });

  it('handles unicode dashes and spaces', () => {
    expect(formatAccessCodeForSubmit('BDY–ABCD–EFGH')).toBe('BDY-ABCD-EFGH');
    expect(formatAccessCodeForSubmit('BDY ABCD EFGH')).toBe('BDY-ABCD-EFGH');
  });

  it('strips WhatsApp bidi isolate marks around the code', () => {
    const withBidi = '\u2066BDY-ABCD-EFGH\u2069';
    expect(formatAccessCodeForSubmit(withBidi)).toBe('BDY-ABCD-EFGH');
  });

  it('formats input progressively', () => {
    expect(formatAccessCodeInput('bdyab')).toBe('BDY-AB');
    expect(formatAccessCodeInput(sample)).toBe('BDY-ABCD-EFGH');
  });

  it('parseAccessCodePaste normalizes clipboard content', () => {
    expect(parseAccessCodePaste(sample)).toBe('BDY-ABCD-EFGH');
  });

  it('returns null for incomplete codes', () => {
    expect(extractAccessCodeCompact('BDY-ABCD')).toBeNull();
    expect(formatAccessCodeForSubmit('BDY-ABCD')).toBeNull();
  });
});
