import { describe, expect, it } from 'vitest';
import { parseDiscountInput, validateDiscountValue } from './marketingFormUtils';

describe('marketingFormUtils', () => {
  it('parses Western digits', () => {
    expect(parseDiscountInput('20')).toBe(20);
    expect(parseDiscountInput('12.5')).toBe(12.5);
  });

  it('parses Arabic-Indic digits', () => {
    expect(parseDiscountInput('٢٠')).toBe(20);
  });

  it('validates percentage range', () => {
    expect(validateDiscountValue('percentage', 20)).toBeNull();
    expect(validateDiscountValue('percentage', 101)).toMatch(/100/);
    expect(validateDiscountValue('percentage', 0)).toMatch(/أكبر من صفر/);
  });
});
