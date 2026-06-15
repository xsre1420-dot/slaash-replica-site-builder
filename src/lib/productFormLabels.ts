/** Standard Arabic labels for product create/edit actions */

export const PRODUCT_SAVE_LABELS = {
  saveDraft: 'حفظ كمسودة',
  saveAndPublish: 'حفظ ونشر',
  saveChanges: 'حفظ التغييرات',
  saving: 'جاري الحفظ…',
} as const;

export const PRODUCT_SAVE_TOAST = {
  draftSuccess: '✓ تم حفظ المنتج كمسودة',
  publishSuccess: '✓ تم حفظ ونشر المنتج',
  updatedSuccess: '✓ تم حفظ المنتج بنجاح',
} as const;

export type ProductSaveMode = 'draft' | 'publish';
