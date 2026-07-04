import type { ColorOption, ProductVariant } from '@/types';

const STORAGE_VERSION = 1;
const KEY_PREFIX = 'add_product_draft_v1:';

export type AddProductDraft = {
  version: typeof STORAGE_VERSION;
  updatedAt: string;
  mainImage: string | null;
  additionalImages: string[];
  name: string;
  description: string;
  shortDescription: string;
  category: string;
  price: string;
  compareAtPrice: string;
  cost: string;
  sku: string;
  sizes: string[];
  colors: ColorOption[];
  stockQuantity: string;
  lowStockThreshold: string;
  variants: ProductVariant[];
  tagsInput: string;
  seoTitle: string;
  seoDescription: string;
  productSlug: string;
  slugTouched: boolean;
};

const draftKey = (userId: string) => `${KEY_PREFIX}${userId}`;

export const loadAddProductDraft = (userId: string): AddProductDraft | null => {
  try {
    const raw = localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AddProductDraft;
    if (parsed.version !== STORAGE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveAddProductDraft = (userId: string, draft: Omit<AddProductDraft, 'version' | 'updatedAt'>): void => {
  try {
    const payload: AddProductDraft = {
      ...draft,
      version: STORAGE_VERSION,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(draftKey(userId), JSON.stringify(payload));
  } catch {
    /* quota or private mode — ignore */
  }
};

export const clearAddProductDraft = (userId: string): void => {
  try {
    localStorage.removeItem(draftKey(userId));
  } catch {
    /* ignore */
  }
};

export const hasMeaningfulAddProductDraft = (draft: AddProductDraft | null): boolean => {
  if (!draft) return false;
  return Boolean(
    draft.mainImage ||
      draft.name.trim() ||
      draft.description.trim() ||
      draft.category ||
      draft.price ||
      draft.additionalImages.length > 0
  );
};
