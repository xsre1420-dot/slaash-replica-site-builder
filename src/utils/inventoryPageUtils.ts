import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { getProductLifecycleStatus, isStorefrontVisible, lifecycleStatusLabel } from '@/lib/productLifecycle';
import { Product, ProductVariant } from '@/types';
import { getAvailableQty } from '@/utils/inventoryUtils';

export type StockFilter = 'all' | 'good' | 'low' | 'out';
export type LifecycleFilter = 'all' | 'published' | 'draft' | 'archived';
export type InventorySort = 'stock_asc' | 'stock_desc' | 'name' | 'recent';

export type InventoryProductRow = {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url?: string;
  stock_quantity?: number;
  min_stock_level?: number;
  sizes?: string[];
  colors?: Product['colors'];
  variants?: ProductVariant[];
  created_at: string;
  lifecycle: ReturnType<typeof getProductLifecycleStatus>;
};

export const toInventoryProduct = (row: InventoryProductRow): Product => ({
  id: row.id,
  name: row.name,
  description: '',
  category: row.category,
  price: row.price,
  image: row.image_url || '',
  stockQuantity: row.stock_quantity,
  sizes: row.sizes,
  colors: row.colors,
  variants: row.variants,
  isActive: row.lifecycle === 'published',
  archivedAt: row.lifecycle === 'archived' ? row.created_at : undefined,
});

export type StockStatus = 'good' | 'low' | 'out';

export type StockStatusInfo = {
  status: StockStatus;
  label: string;
  sellable: boolean;
};

export const getInventoryStockStatus = (row: InventoryProductRow): StockStatusInfo => {
  const product = toInventoryProduct(row);
  const sellable = isStorefrontVisible(product);
  const quantity = getAvailableQty(product);
  const minLevel = row.min_stock_level || 5;

  if (!sellable) {
    return { status: 'out', label: 'غير معروض للبيع', sellable: false };
  }
  if (quantity === 0) return { status: 'out', label: 'نفد المخزون', sellable: true };
  if (quantity <= minLevel) return { status: 'low', label: 'مخزون منخفض', sellable: true };
  return { status: 'good', label: 'متوفر', sellable: true };
};

export const getStockLevelPercent = (row: InventoryProductRow): number => {
  const qty = getAvailableQty(toInventoryProduct(row));
  const minLevel = row.min_stock_level || 5;
  const target = Math.max(minLevel * 3, 10);
  return Math.min(100, Math.round((qty / target) * 100));
};

export const computeInventoryStats = (products: InventoryProductRow[]) => {
  let good = 0;
  let low = 0;
  let out = 0;
  let totalStock = 0;
  let inventoryValue = 0;

  for (const row of products) {
    const status = getInventoryStockStatus(row).status;
    if (status === 'good') good += 1;
    else if (status === 'low') low += 1;
    else if (status === 'out') out += 1;

    const qty = getAvailableQty(toInventoryProduct(row));
    totalStock += qty;
    inventoryValue += qty * row.price;
  }

  return {
    total: products.length,
    good,
    low,
    out,
    totalStock,
    inventoryValue,
  };
};

export const filterInventoryProducts = (
  products: InventoryProductRow[],
  opts: {
    search: string;
    stockFilter: StockFilter;
    category: string;
    lifecycle: LifecycleFilter;
    lowStockOnly: boolean;
  }
) => {
  const term = opts.search.trim().toLowerCase();

  return products.filter((row) => {
    const matchesSearch =
      !term ||
      row.name.toLowerCase().includes(term) ||
      row.category.toLowerCase().includes(term);

    const stockStatus = getInventoryStockStatus(row).status;
    const matchesStock = opts.stockFilter === 'all' || stockStatus === opts.stockFilter;
    const matchesCategory = opts.category === 'all' || row.category === opts.category;
    const matchesLifecycle = opts.lifecycle === 'all' || row.lifecycle === opts.lifecycle;
    const matchesLowOnly =
      !opts.lowStockOnly || stockStatus === 'low' || stockStatus === 'out';

    return matchesSearch && matchesStock && matchesCategory && matchesLifecycle && matchesLowOnly;
  });
};

export const sortInventoryProducts = (
  products: InventoryProductRow[],
  sort: InventorySort
): InventoryProductRow[] => {
  const sorted = [...products];

  sorted.sort((a, b) => {
    const qtyA = getAvailableQty(toInventoryProduct(a));
    const qtyB = getAvailableQty(toInventoryProduct(b));

    switch (sort) {
      case 'stock_asc':
        return qtyA - qtyB || a.name.localeCompare(b.name, 'ar');
      case 'stock_desc':
        return qtyB - qtyA || a.name.localeCompare(b.name, 'ar');
      case 'name':
        return a.name.localeCompare(b.name, 'ar');
      case 'recent':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  return sorted;
};

export const getUniqueCategories = (products: InventoryProductRow[]) =>
  [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ar')
  );

export const getSuggestedRestockAmount = (row: InventoryProductRow): number => {
  const qty = getAvailableQty(toInventoryProduct(row));
  const min = row.min_stock_level ?? 5;
  const target = Math.max(min * 2, min + 5);

  if (qty >= target) return 10;
  return Math.max(target - qty, 1);
};

export const INVENTORY_REASON_LABELS: Record<string, string> = {
  restock: 'إعادة تعبئة',
  manual_adjustment: 'تعديل يدوي (قديم)',
  initial_stock: 'مخزون ابتدائي',
  order_created: 'خصم تلقائي — طلب',
  order: 'خصم — طلب',
  stock_deduction: 'خصم مخزون — طلب',
  order_cancelled: 'استرجاع — إلغاء طلب',
};

export const formatMovementReason = (reason: string) =>
  INVENTORY_REASON_LABELS[reason] ?? reason;

export type InventoryMovementRow = {
  id: string;
  quantity_delta: number;
  reason: string;
  created_at: string;
};

export const summarizeMovements = (movements: InventoryMovementRow[]) => {
  let added = 0;
  let removed = 0;
  for (const m of movements) {
    if (m.quantity_delta >= 0) added += m.quantity_delta;
    else removed += Math.abs(m.quantity_delta);
  }
  return { added, removed, net: added - removed };
};

export const groupMovementsByDay = (movements: InventoryMovementRow[]) => {
  const groups = new Map<string, InventoryMovementRow[]>();
  for (const m of movements) {
    const key = format(new Date(m.created_at), 'yyyy-MM-dd');
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([day, items]) => ({ day, items }));
};

export const formatMovementDayLabel = (dayKey: string) => {
  const date = new Date(`${dayKey}T12:00:00`);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) return 'اليوم';
  if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) return 'أمس';
  return format(date, 'd MMMM yyyy', { locale: ar });
};

export const isRestockReason = (reason: string) =>
  reason === 'restock' || reason === 'initial_stock' || reason === 'manual_adjustment';

export const stockStatusBadgeClasses = (status: string) => {
  switch (status) {
    case 'out':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'low':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    default:
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  }
};

export const lifecycleBadgeClasses = (lifecycle: InventoryProductRow['lifecycle']) => {
  switch (lifecycle) {
    case 'archived':
      return 'bg-muted text-muted-foreground border-border';
    case 'draft':
      return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    default:
      return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
  }
};

export { lifecycleStatusLabel };
