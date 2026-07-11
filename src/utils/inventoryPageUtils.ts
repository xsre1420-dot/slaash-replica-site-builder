import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { getProductLifecycleStatus, isStorefrontVisible, lifecycleStatusLabel } from '@/lib/productLifecycle';
import { Product, ProductVariant } from '@/types';
import { getAvailableQty } from '@/utils/inventoryUtils';

export type StockFilter = 'all' | 'good' | 'low' | 'out';
export type LifecycleFilter = 'all' | 'published' | 'draft' | 'archived';
export type InventorySort = 'stock_asc' | 'stock_desc' | 'name' | 'recent' | 'value_desc' | 'profit_desc';
export type InventoryViewMode = 'cards' | 'table';

export type InventoryAdvancedFilters = {
  hasImage?: boolean | null;
  hasVariants?: boolean | null;
  missingSku?: boolean;
  priceMin?: number | null;
  priceMax?: number | null;
  qtyMin?: number | null;
  qtyMax?: number | null;
};

export type InventoryFilterPreset = {
  id: string;
  name: string;
  stockFilter: StockFilter;
  lifecycle: LifecycleFilter;
  category: string;
  lowStockOnly: boolean;
  advanced: InventoryAdvancedFilters;
};

export type InventoryProductRow = {
  id: string;
  name: string;
  price: number;
  cost?: number;
  sku?: string;
  barcode?: string;
  category: string;
  image_url?: string;
  stock_quantity?: number;
  min_stock_level?: number;
  sizes?: string[];
  colors?: Product['colors'];
  variants?: ProductVariant[];
  created_at: string;
  updated_at?: string;
  archived_at?: string;
  lifecycle: ReturnType<typeof getProductLifecycleStatus>;
};

export const productToInventoryRow = (p: Product): InventoryProductRow => ({
  id: p.id,
  name: p.name,
  price: p.price,
  cost: p.cost,
  sku: p.sku,
  barcode: p.barcode,
  category: p.category,
  image_url: p.image,
  stock_quantity: p.stockQuantity,
  min_stock_level: p.lowStockThreshold,
  sizes: p.sizes,
  colors: p.colors,
  variants: p.variants,
  created_at: (p as Product & { created_at?: string }).created_at || new Date().toISOString(),
  updated_at: (p as Product & { updated_at?: string }).updated_at,
  archived_at: p.archivedAt,
  lifecycle: getProductLifecycleStatus(p),
});

export const toInventoryProduct = (row: InventoryProductRow): Product => ({
  id: row.id,
  name: row.name,
  description: '',
  category: row.category,
  price: row.price,
  cost: row.cost,
  sku: row.sku,
  image: row.image_url || '',
  stockQuantity: row.stock_quantity,
  sizes: row.sizes,
  colors: row.colors,
  variants: row.variants,
  isActive: row.lifecycle === 'published',
  archivedAt: row.lifecycle === 'archived' ? row.archived_at ?? row.created_at : undefined,
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

export const getRowAvailableQty = (row: InventoryProductRow) =>
  getAvailableQty(toInventoryProduct(row));

export const getRowRetailValue = (row: InventoryProductRow) =>
  getRowAvailableQty(row) * row.price;

export const getRowCostValue = (row: InventoryProductRow) => {
  const qty = getRowAvailableQty(row);
  const unitCost = row.cost ?? 0;
  return qty * unitCost;
};

export const getRowProfit = (row: InventoryProductRow) => {
  const qty = getRowAvailableQty(row);
  const unitCost = row.cost ?? 0;
  return qty * (row.price - unitCost);
};

export const getRowMarginPercent = (row: InventoryProductRow): number | null => {
  if (!row.cost || row.price <= 0) return null;
  return Math.round(((row.price - row.cost) / row.price) * 100);
};

export type InventoryStats = {
  total: number;
  good: number;
  low: number;
  out: number;
  totalStock: number;
  inventoryValue: number;
  costValue: number;
  expectedProfit: number;
  profitMargin: number | null;
  published: number;
  draft: number;
  archived: number;
  withVariants: number;
  missingSku: number;
  missingImage: number;
};

export const computeInventoryStats = (products: InventoryProductRow[]): InventoryStats => {
  let good = 0;
  let low = 0;
  let out = 0;
  let totalStock = 0;
  let inventoryValue = 0;
  let costValue = 0;
  let published = 0;
  let draft = 0;
  let archived = 0;
  let withVariants = 0;
  let missingSku = 0;
  let missingImage = 0;

  for (const row of products) {
    const status = getInventoryStockStatus(row).status;
    if (status === 'good') good += 1;
    else if (status === 'low') low += 1;
    else if (status === 'out') out += 1;

    if (row.lifecycle === 'published') published += 1;
    else if (row.lifecycle === 'draft') draft += 1;
    else archived += 1;

    if (row.variants?.length || row.sizes?.length || row.colors?.length) withVariants += 1;
    if (!row.sku?.trim()) missingSku += 1;
    if (!row.image_url?.trim()) missingImage += 1;

    const qty = getRowAvailableQty(row);
    totalStock += qty;
    inventoryValue += qty * row.price;
    costValue += qty * (row.cost ?? 0);
  }

  const expectedProfit = inventoryValue - costValue;
  const profitMargin =
    inventoryValue > 0 && costValue > 0
      ? Math.round((expectedProfit / inventoryValue) * 100)
      : null;

  return {
    total: products.length,
    good,
    low,
    out,
    totalStock,
    inventoryValue,
    costValue,
    expectedProfit,
    profitMargin,
    published,
    draft,
    archived,
    withVariants,
    missingSku,
    missingImage,
  };
};

export type InventoryAlertUrgency = 'critical' | 'high' | 'medium' | 'low';

export type InventoryAlert = {
  id: string;
  urgency: InventoryAlertUrgency;
  title: string;
  description: string;
  count: number;
  actionLabel?: string;
  filterKey?: keyof InventoryAdvancedFilters | 'stock' | 'lifecycle';
  filterValue?: string;
};

export const computeInventoryAlerts = (
  products: InventoryProductRow[],
  integrityIssues?: number
): InventoryAlert[] => {
  const stats = computeInventoryStats(products);
  const alerts: InventoryAlert[] = [];

  if (stats.out > 0) {
    alerts.push({
      id: 'out-of-stock',
      urgency: 'critical',
      title: 'نفاد المخزون',
      description: `${stats.out} منتج غير متوفر للبيع الآن`,
      count: stats.out,
      actionLabel: 'عرض الناقص',
      filterKey: 'stock',
      filterValue: 'out',
    });
  }

  if (stats.low > 0) {
    alerts.push({
      id: 'low-stock',
      urgency: 'high',
      title: 'مخزون منخفض',
      description: `${stats.low} منتج يحتاج إعادة تعبئة قريباً`,
      count: stats.low,
      actionLabel: 'عرض المنخفض',
      filterKey: 'stock',
      filterValue: 'low',
    });
  }

  if (stats.missingImage > 0) {
    alerts.push({
      id: 'missing-image',
      urgency: 'medium',
      title: 'بدون صورة',
      description: `${stats.missingImage} منتج بدون صورة — يؤثر على المبيعات`,
      count: stats.missingImage,
      actionLabel: 'عرض',
      filterKey: 'hasImage',
      filterValue: 'false',
    });
  }

  if (stats.missingSku > 0) {
    alerts.push({
      id: 'missing-sku',
      urgency: 'medium',
      title: 'بدون SKU',
      description: `${stats.missingSku} منتج بدون رمز SKU`,
      count: stats.missingSku,
      actionLabel: 'عرض',
      filterKey: 'missingSku',
      filterValue: 'true',
    });
  }

  if (stats.draft > 0) {
    alerts.push({
      id: 'draft-products',
      urgency: 'low',
      title: 'مسودات',
      description: `${stats.draft} منتج في المسودة — غير معروض`,
      count: stats.draft,
      actionLabel: 'عرض المسودات',
      filterKey: 'lifecycle',
      filterValue: 'draft',
    });
  }

  if (integrityIssues && integrityIssues > 0) {
    alerts.push({
      id: 'integrity',
      urgency: 'high',
      title: 'عدم تطابق المخزون',
      description: `${integrityIssues} مشكلة في سجل المخزون`,
      count: integrityIssues,
    });
  }

  const urgencyOrder: Record<InventoryAlertUrgency, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return alerts.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
};

export type InventoryInsight = {
  id: string;
  title: string;
  description: string;
  productIds: string[];
};

export const computeInventoryInsights = (products: InventoryProductRow[]): InventoryInsight[] => {
  const withQty = products.map((p) => ({
    row: p,
    qty: getRowAvailableQty(p),
    value: getRowRetailValue(p),
    profit: getRowProfit(p),
    margin: getRowMarginPercent(p),
  }));

  const needsRestock = withQty
    .filter(({ row }) => {
      const s = getInventoryStockStatus(row).status;
      return s === 'low' || s === 'out';
    })
    .sort((a, b) => a.qty - b.qty)
    .slice(0, 5);

  const highValue = [...withQty].sort((a, b) => b.value - a.value).slice(0, 5);

  const bestMargin = withQty
    .filter(({ margin }) => margin != null && margin > 0)
    .sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0))
    .slice(0, 5);

  const recentlyAdded = [...products]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const noImage = products.filter((p) => !p.image_url?.trim()).slice(0, 5);

  const insights: InventoryInsight[] = [];

  if (needsRestock.length) {
    insights.push({
      id: 'needs-restock',
      title: 'يحتاج تعبئة',
      description: `${needsRestock.length} منتجات أولوية`,
      productIds: needsRestock.map(({ row }) => row.id),
    });
  }

  if (highValue.length) {
    insights.push({
      id: 'high-value',
      title: 'أعلى قيمة مخزون',
      description: highValue[0]?.row.name ?? '',
      productIds: highValue.map(({ row }) => row.id),
    });
  }

  if (bestMargin.length) {
    insights.push({
      id: 'best-margin',
      title: 'أفضل هامش ربح',
      description: bestMargin[0]?.row.name ?? '',
      productIds: bestMargin.map(({ row }) => row.id),
    });
  }

  if (recentlyAdded.length) {
    insights.push({
      id: 'recent',
      title: 'أُضيفت مؤخراً',
      description: `${recentlyAdded.length} منتجات جديدة`,
      productIds: recentlyAdded.map((p) => p.id),
    });
  }

  if (noImage.length) {
    insights.push({
      id: 'no-image',
      title: 'بدون صور',
      description: `${noImage.length} منتجات`,
      productIds: noImage.map((p) => p.id),
    });
  }

  return insights;
};

const normalizeSearch = (value: string) => value.trim().toLowerCase();

/** Simple fuzzy: all query chars appear in order within target */
export const fuzzyMatch = (query: string, target: string): boolean => {
  const q = normalizeSearch(query);
  const t = normalizeSearch(target);
  if (!q) return true;
  if (t.includes(q)) return true;
  let ti = 0;
  for (const ch of q) {
    ti = t.indexOf(ch, ti);
    if (ti === -1) return false;
    ti += 1;
  }
  return true;
};

export const matchesInventorySearch = (row: InventoryProductRow, search: string): boolean => {
  const term = search.trim();
  if (!term) return true;
  const fields = [row.name, row.category, row.sku ?? ''].filter(Boolean);
  return fields.some((f) => fuzzyMatch(term, f));
};

export const filterInventoryProducts = (
  products: InventoryProductRow[],
  opts: {
    search: string;
    stockFilter: StockFilter;
    category: string;
    lifecycle: LifecycleFilter;
    lowStockOnly: boolean;
    advanced?: InventoryAdvancedFilters;
    productIds?: Set<string>;
  }
) => {
  return products.filter((row) => {
    const matchesSearch = matchesInventorySearch(row, opts.search);

    const stockStatus = getInventoryStockStatus(row).status;
    const matchesStock = opts.stockFilter === 'all' || stockStatus === opts.stockFilter;
    const matchesCategory = opts.category === 'all' || row.category === opts.category;
    const matchesLifecycle = opts.lifecycle === 'all' || row.lifecycle === opts.lifecycle;
    const matchesLowOnly =
      !opts.lowStockOnly || stockStatus === 'low' || stockStatus === 'out';

    const adv = opts.advanced ?? {};
    const hasImage = Boolean(row.image_url?.trim());
    const hasVariants = Boolean(row.variants?.length || row.sizes?.length || row.colors?.length);
    const qty = getRowAvailableQty(row);

    const matchesImage =
      adv.hasImage == null || adv.hasImage === hasImage;
    const matchesVariants =
      adv.hasVariants == null || adv.hasVariants === hasVariants;
    const matchesMissingSku = !adv.missingSku || !row.sku?.trim();
    const matchesPriceMin = adv.priceMin == null || row.price >= adv.priceMin;
    const matchesPriceMax = adv.priceMax == null || row.price <= adv.priceMax;
    const matchesQtyMin = adv.qtyMin == null || qty >= adv.qtyMin;
    const matchesQtyMax = adv.qtyMax == null || qty <= adv.qtyMax;
    const matchesIds = !opts.productIds?.size || opts.productIds.has(row.id);

    return (
      matchesSearch &&
      matchesStock &&
      matchesCategory &&
      matchesLifecycle &&
      matchesLowOnly &&
      matchesImage &&
      matchesVariants &&
      matchesMissingSku &&
      matchesPriceMin &&
      matchesPriceMax &&
      matchesQtyMin &&
      matchesQtyMax &&
      matchesIds
    );
  });
};

export const sortInventoryProducts = (
  products: InventoryProductRow[],
  sort: InventorySort
): InventoryProductRow[] => {
  const sorted = [...products];

  sorted.sort((a, b) => {
    const qtyA = getRowAvailableQty(a);
    const qtyB = getRowAvailableQty(b);

    switch (sort) {
      case 'stock_asc':
        return qtyA - qtyB || a.name.localeCompare(b.name, 'ar');
      case 'stock_desc':
        return qtyB - qtyA || a.name.localeCompare(b.name, 'ar');
      case 'value_desc':
        return getRowRetailValue(b) - getRowRetailValue(a);
      case 'profit_desc':
        return getRowProfit(b) - getRowProfit(a);
      case 'name':
        return a.name.localeCompare(b.name, 'ar');
      case 'recent':
      default:
        return (
          new Date(b.updated_at ?? b.created_at).getTime() -
          new Date(a.updated_at ?? a.created_at).getTime()
        );
    }
  });

  return sorted;
};

export const getUniqueCategories = (products: InventoryProductRow[]) =>
  [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ar')
  );

export const getSuggestedRestockAmount = (row: InventoryProductRow): number => {
  const qty = getRowAvailableQty(row);
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
  threshold_update: 'تحديث حد التنبيه',
  purchase_order_receive: 'استلام — أمر شراء',
  warehouse_transfer_in: 'نقل — وارد',
  warehouse_transfer_out: 'نقل — صادر',
  cycle_count_adjustment: 'تعديل — جرد',
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

export const alertUrgencyClasses = (urgency: InventoryAlertUrgency) => {
  switch (urgency) {
    case 'critical':
      return 'border-destructive/30 bg-destructive/5';
    case 'high':
      return 'border-amber-500/30 bg-amber-500/5';
    case 'medium':
      return 'border-primary/25 bg-primary/5';
    default:
      return 'border-border/60 bg-muted/30';
  }
};

const RECENT_SEARCHES_KEY = 'inventory_recent_searches';
const FILTER_PRESETS_KEY = 'inventory_filter_presets';

export const loadRecentSearches = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, 8) : [];
  } catch {
    return [];
  }
};

export const saveRecentSearch = (term: string) => {
  const trimmed = term.trim();
  if (!trimmed) return;
  const prev = loadRecentSearches().filter((s) => s !== trimmed);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([trimmed, ...prev].slice(0, 8)));
};

export const loadFilterPresets = (): InventoryFilterPreset[] => {
  try {
    const raw = localStorage.getItem(FILTER_PRESETS_KEY);
    return raw ? (JSON.parse(raw) as InventoryFilterPreset[]) : [];
  } catch {
    return [];
  }
};

export const saveFilterPreset = (preset: InventoryFilterPreset) => {
  const prev = loadFilterPresets().filter((p) => p.id !== preset.id);
  localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify([preset, ...prev].slice(0, 6)));
};

export const exportInventoryCsv = (products: InventoryProductRow[]) => {
  const headers = [
    'اسم المنتج',
    'SKU',
    'التصنيف',
    'سعر البيع',
    'التكلفة',
    'الكمية',
    'الحد الأدنى',
    'قيمة البيع',
    'قيمة التكلفة',
    'الربح المتوقع',
    'الحالة',
    'حالة النشر',
  ];
  const rows = products.map((p) => {
    const s = getInventoryStockStatus(p);
    const qty = getRowAvailableQty(p);
    return [
      p.name,
      p.sku ?? '',
      p.category,
      p.price,
      p.cost ?? '',
      qty,
      p.min_stock_level || 5,
      getRowRetailValue(p),
      getRowCostValue(p),
      getRowProfit(p),
      s.label,
      lifecycleStatusLabel[p.lifecycle],
    ];
  });
  return '\uFEFF' + [headers, ...rows].map((r) => r.join(',')).join('\n');
};

export { lifecycleStatusLabel };
