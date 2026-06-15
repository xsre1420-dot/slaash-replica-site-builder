import { describe, it, expect } from 'vitest';
import { PRODUCT_SAVE_LABELS, PRODUCT_SAVE_TOAST } from './productFormLabels';

describe('productFormLabels', () => {
  it('uses professional Arabic save labels', () => {
    expect(PRODUCT_SAVE_LABELS.saveDraft).toBe('حفظ كمسودة');
    expect(PRODUCT_SAVE_LABELS.saveAndPublish).toBe('حفظ ونشر');
    expect(PRODUCT_SAVE_LABELS.saveChanges).toBe('حفظ التغييرات');
  });

  it('includes success toast prefixes', () => {
    expect(PRODUCT_SAVE_TOAST.draftSuccess).toMatch(/^✓/);
    expect(PRODUCT_SAVE_TOAST.publishSuccess).toMatch(/^✓/);
    expect(PRODUCT_SAVE_TOAST.updatedSuccess).toMatch(/^✓/);
  });
});
