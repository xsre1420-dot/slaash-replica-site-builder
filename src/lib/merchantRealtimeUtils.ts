/** Fields that change frequently but do not affect merchant UI lists or storefront. */
export const PRODUCT_NOISE_FIELDS = new Set(['updated_at', 'min_stock_level']);

/** Order columns that never warrant a list refetch on their own. */
export const ORDER_NOISE_FIELDS = new Set(['updated_at']);

/** Product columns that affect the public storefront catalog. */
export const STOREFRONT_FIELDS = new Set([
  'stock_quantity',
  'variants',
  'price',
  'original_price',
  'discount_type',
  'discount_value',
  'discount_start_date',
  'discount_end_date',
  'is_active',
  'archived_at',
  'name',
  'description',
  'short_description',
  'category',
  'image_url',
  'additional_images',
  'sizes',
  'colors',
  'product_slug',
  'tags',
]);

export const getChangedFieldKeys = (
  next: Record<string, unknown> | undefined,
  prev: Record<string, unknown> | undefined
): string[] => {
  if (!next && !prev) return [];
  const keys = new Set([...Object.keys(next ?? {}), ...Object.keys(prev ?? {})]);
  const changed: string[] = [];
  for (const key of keys) {
    if (next?.[key] !== prev?.[key]) changed.push(key);
  }
  return changed;
};

export const isNoiseOnlyChange = (changedKeys: string[], noiseFields: Set<string>): boolean =>
  changedKeys.length > 0 && changedKeys.every((key) => noiseFields.has(key));

export const shouldInvalidateStorefront = (input: {
  eventType: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
}): boolean => {
  if (input.eventType === 'DELETE') return true;
  const row = input.new;
  if (!row) return false;
  const changed = getChangedFieldKeys(row, input.old);
  if (changed.length === 0) {
    return Object.keys(row).some((key) => STOREFRONT_FIELDS.has(key));
  }
  return changed.some((key) => STOREFRONT_FIELDS.has(key));
};
