import type { CartItem, ColorOption } from '@/types';

const isHexColor = (value: string) => /^#[0-9a-f]{3,8}$/i.test(value.trim());

export type OrderItemColorDisplay = {
  name?: string;
  image?: string;
};

/** Resolve color label + thumbnail for order/cart line items (never shows raw hex). */
export const resolveOrderItemColor = (item: CartItem): OrderItemColorDisplay | null => {
  const selected = item.selectedColor?.trim();
  if (!selected) return null;

  const colorOpt = item.product.colors?.find(
    (c) => c.value === selected || c.name === selected
  );

  const name =
    item.selectedColorName?.trim() ||
    colorOpt?.name?.trim() ||
    (!isHexColor(selected) ? selected : undefined);
  const image = item.selectedColorImage?.trim() || colorOpt?.image?.trim();

  if (!name && !image) return null;

  return { name, image };
};

export const findProductColorOption = (
  colors: ColorOption[] | undefined,
  selected?: string
): ColorOption | undefined => {
  if (!selected?.trim() || !colors?.length) return undefined;
  return colors.find((c) => c.value === selected || c.name === selected) ??
    colors.find(
      (c) =>
        c.value.toLowerCase() === selected.toLowerCase() ||
        (c.name != null && c.name.toLowerCase() === selected.toLowerCase())
    );
};
