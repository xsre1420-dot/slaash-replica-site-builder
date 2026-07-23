/** Parse discount numeric input (Western or Arabic-Indic digits). */
export function parseDiscountInput(raw: string): number {
  const normalized = raw
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '');
  if (!normalized) return NaN;
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : NaN;
}

export function validateDiscountValue(
  type: 'percentage' | 'fixed_amount' | 'amount' | 'none',
  value: number
): string | null {
  if (type === 'none') return null;
  if (!Number.isFinite(value) || value <= 0) {
    return 'يرجى إدخال قيمة خصم أكبر من صفر';
  }
  if (type === 'percentage' && value > 100) {
    return 'نسبة الخصم يجب أن تكون بين 1 و 100';
  }
  return null;
}
