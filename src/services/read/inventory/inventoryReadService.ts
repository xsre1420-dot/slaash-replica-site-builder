/**
 * Inventory audit and movement history — read-only.
 */
import { fetchInventorySummaryCached, invalidateInventorySummaryCache } from '@/lib/cache/inventoryCacheLayer';
import {
  rpcAuditMerchantInventoryIntegrity,
  rpcMerchantInventorySummary,
  rpcListMerchantInventoryMovements,
  rpcMerchantInventoryForecast,
  rpcMerchantAbcAnalysis,
  rpcLookupProductByBarcode,
  inventoryMovementsTable,
  warehousesTable,
  warehouseStockTable,
  suppliersTable,
  purchaseOrdersTable,
  purchaseOrderLinesTable,
  cycleCountsTable,
  cycleCountLinesTable,
  getAuthUserId,
} from '@/repositories/inventory/inventoryRepository';
import { assertMerchantOwner } from '@/lib/tenantGuard';
import {
  hasWarehouseInventory,
  hasMerchantInventorySummaryRpc,
  hasInventoryMovementsRpc,
  hasPremiumInventoryForecastRpc,
  hasPremiumInventoryAbcRpc,
} from '@/lib/supabase/schemaCapabilities';
import { computeMerchantInventorySummaryFromProducts } from '@/lib/inventory/simpleInventorySummary';
import { supabase } from '@/integrations/supabase/client';

export class InventoryRestockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryRestockError';
  }
}

export type InventoryMovementRow = {
  id: string;
  quantity_delta: number;
  reason: string;
  created_at: string;
  order_id?: string | null;
  product_id?: string;
  product_name?: string;
  sku?: string;
};

export type MerchantInventorySummary = {
  totalProducts: number;
  published: number;
  draft: number;
  archived: number;
  totalUnits: number;
  retailValue: number;
  costValue: number;
  missingSku: number;
  missingBarcode: number;
  missingImage: number;
  lowStock: number;
  outOfStock: number;
  incomingUnits: number;
  reservedUnits: number;
};

export type InventoryForecastItem = {
  product_id: string;
  name: string;
  sku?: string;
  current_stock: number;
  min_stock_level: number;
  sold_last_30_days: number;
  days_until_stockout: number | null;
  suggested_reorder_qty: number | null;
};

export type AbcAnalysisItem = {
  product_id: string;
  name: string;
  revenue: number;
  units_sold: number;
  abc_class: 'A' | 'B' | 'C';
};

export type WarehouseRow = {
  id: string;
  name: string;
  code?: string;
  is_default: boolean;
  address?: string;
  is_active: boolean;
};

export type SupplierRow = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
};

export type PurchaseOrderRow = {
  id: string;
  status: string;
  reference_code?: string;
  expected_at?: string;
  notes?: string;
  created_at: string;
  supplier_id?: string;
  suppliers?: { name: string } | null;
};

export type PurchaseOrderLineRow = {
  id: string;
  product_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost?: number;
  products?: { name: string; sku?: string } | null;
};

export type CycleCountRow = {
  id: string;
  name?: string;
  status: string;
  started_at: string;
  completed_at?: string;
};

export type CycleCountLineRow = {
  id: string;
  product_id: string;
  expected_qty: number;
  counted_qty?: number;
  variance?: number;
  products?: { name: string } | null;
};

export type InventoryIntegritySummary = {
  negative_stock: number;
  variant_drift: number;
  duplicate_initial_stock: number;
  missing_initial_stock: number;
  ledger_mismatch: number;
  orphan_movements: number;
  archived_still_active: number;
};

export type InventoryIntegrityResult = {
  score: number;
  totalProducts: number;
  issuesCount: number;
  summary: InventoryIntegritySummary;
  issues: Record<string, unknown>[];
};

export const auditInventoryIntegrity = async (
  ownerId: string
): Promise<InventoryIntegrityResult | null> => {
  await assertMerchantOwner(ownerId);

  const { data, error } = await rpcAuditMerchantInventoryIntegrity(ownerId);

  const payload = data as {
    success?: boolean;
    score?: number;
    total_products?: number;
    issues_count?: number;
    summary?: InventoryIntegritySummary;
    issues?: Record<string, unknown>[];
    error?: string;
  };

  if (error || !payload?.success) return null;

  return {
    score: payload.score ?? 0,
    totalProducts: payload.total_products ?? 0,
    issuesCount: payload.issues_count ?? 0,
    summary: payload.summary ?? {
      negative_stock: 0,
      variant_drift: 0,
      duplicate_initial_stock: 0,
      missing_initial_stock: 0,
      ledger_mismatch: 0,
      orphan_movements: 0,
      archived_still_active: 0,
    },
    issues: payload.issues ?? [],
  };
};

export function mapMerchantInventorySummaryPayload(
  p: Record<string, unknown> | null | undefined
): MerchantInventorySummary | null {
  if (!p?.success) return null;
  return {
    totalProducts: Number(p.total_products ?? 0),
    published: Number(p.published ?? 0),
    draft: Number(p.draft ?? 0),
    archived: Number(p.archived ?? 0),
    totalUnits: Number(p.total_units ?? 0),
    retailValue: Number(p.retail_value ?? 0),
    costValue: Number(p.cost_value ?? 0),
    missingSku: Number(p.missing_sku ?? 0),
    missingBarcode: Number(p.missing_barcode ?? 0),
    missingImage: Number(p.missing_image ?? 0),
    lowStock: Number(p.low_stock ?? 0),
    outOfStock: Number(p.out_of_stock ?? 0),
    incomingUnits: Number(p.incoming_units ?? 0),
    reservedUnits: Number(p.reserved_units ?? 0),
  };
}

export const fetchMerchantInventorySummary = async (
  ownerId: string
): Promise<MerchantInventorySummary | null> => {
  await assertMerchantOwner(ownerId);
  return fetchInventorySummaryCached(ownerId, async () => {
    if (await hasMerchantInventorySummaryRpc()) {
      const { data, error } = await rpcMerchantInventorySummary(ownerId);
      const p = data as Record<string, unknown>;
      if (!error && p?.success) {
        return mapMerchantInventorySummaryPayload(p);
      }
    }

    const { data: rows, error: productsError } = await supabase
      .from('products')
      .select('id, price, cost, sku, image_url, stock_quantity, min_stock_level, is_active, archived_at')
      .eq('owner_id', ownerId);

    if (productsError || !rows?.length) return null;

    const products = rows.map((row) => ({
      id: String(row.id),
      name: '',
      description: '',
      category: '',
      price: Number(row.price ?? 0),
      cost: row.cost != null ? Number(row.cost) : undefined,
      sku: row.sku ?? undefined,
      image: row.image_url ?? '',
      stockQuantity: row.stock_quantity != null ? Number(row.stock_quantity) : undefined,
      lowStockThreshold: row.min_stock_level != null ? Number(row.min_stock_level) : undefined,
      isActive: row.is_active ?? true,
      archivedAt: row.archived_at ?? undefined,
    }));

    return computeMerchantInventorySummaryFromProducts(products);
  });
};

export { invalidateInventorySummaryCache };

export const fetchGlobalMovements = async (
  ownerId: string,
  opts?: { from?: string; to?: string; limit?: number }
): Promise<InventoryMovementRow[]> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasInventoryMovementsRpc())) return [];
  const { data, error } = await rpcListMerchantInventoryMovements(
    ownerId,
    opts?.from,
    opts?.to,
    opts?.limit ?? 100
  );
  const p = data as { success?: boolean; movements?: InventoryMovementRow[] };
  if (error || !p?.success) return [];
  return p.movements ?? [];
};

export const fetchInventoryForecast = async (
  ownerId: string
): Promise<InventoryForecastItem[]> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasPremiumInventoryForecastRpc())) return [];
  const { data, error } = await rpcMerchantInventoryForecast(ownerId);
  const p = data as { success?: boolean; items?: InventoryForecastItem[] };
  if (error || !p?.success) return [];
  return p.items ?? [];
};

export const fetchAbcAnalysis = async (ownerId: string): Promise<AbcAnalysisItem[]> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasPremiumInventoryAbcRpc())) return [];
  const { data, error } = await rpcMerchantAbcAnalysis(ownerId);
  const p = data as { success?: boolean; items?: AbcAnalysisItem[] };
  if (error || !p?.success) return [];
  return p.items ?? [];
};

export const lookupProductByBarcode = async (
  ownerId: string,
  barcode: string
): Promise<{ id: string; name: string; sku?: string; stock_quantity?: number } | null> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasWarehouseInventory())) return null;
  const trimmed = barcode.trim();
  if (!trimmed) return null;
  const { data, error } = await rpcLookupProductByBarcode(ownerId, trimmed);
  const p = data as { success?: boolean; product?: Record<string, unknown>; error?: string };
  if (error || !p?.success || !p.product) return null;
  return {
    id: String(p.product.id),
    name: String(p.product.name),
    sku: p.product.sku as string | undefined,
    stock_quantity: p.product.stock_quantity != null ? Number(p.product.stock_quantity) : undefined,
  };
};

export const fetchWarehouses = async (ownerId: string): Promise<WarehouseRow[]> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasWarehouseInventory())) return [];
  const { data, error } = await warehousesTable()
    .select('id, name, code, is_default, address, is_active')
    .eq('owner_id', ownerId)
    .order('is_default', { ascending: false });
  if (error || !data) return [];
  return data as WarehouseRow[];
};

export const fetchSuppliers = async (ownerId: string): Promise<SupplierRow[]> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasWarehouseInventory())) return [];
  const { data, error } = await suppliersTable()
    .select('id, name, phone, email, notes')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .order('name');
  if (error || !data) return [];
  return data as SupplierRow[];
};

export const fetchPurchaseOrders = async (ownerId: string): Promise<PurchaseOrderRow[]> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasWarehouseInventory())) return [];
  const { data, error } = await purchaseOrdersTable()
    .select('id, status, reference_code, expected_at, notes, created_at, supplier_id, suppliers(name)')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data as PurchaseOrderRow[];
};

export const fetchPurchaseOrderLines = async (
  poId: string,
  ownerId: string
): Promise<PurchaseOrderLineRow[]> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasWarehouseInventory())) return [];
  const { data, error } = await purchaseOrderLinesTable()
    .select('id, product_id, quantity_ordered, quantity_received, unit_cost, products(name, sku)')
    .eq('purchase_order_id', poId)
    .eq('owner_id', ownerId);
  if (error || !data) return [];
  return data as PurchaseOrderLineRow[];
};

export const fetchOpenCycleCounts = async (ownerId: string): Promise<CycleCountRow[]> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasWarehouseInventory())) return [];
  const { data, error } = await cycleCountsTable()
    .select('id, name, status, started_at, completed_at')
    .eq('owner_id', ownerId)
    .eq('status', 'open')
    .order('started_at', { ascending: false });
  if (error || !data) return [];
  return data as CycleCountRow[];
};

export const fetchCycleCountLines = async (
  countId: string,
  ownerId: string
): Promise<CycleCountLineRow[]> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasWarehouseInventory())) return [];
  const { data, error } = await cycleCountLinesTable()
    .select('id, product_id, expected_qty, counted_qty, variance, products(name)')
    .eq('cycle_count_id', countId)
    .eq('owner_id', ownerId);
  if (error || !data) return [];
  return data as CycleCountLineRow[];
};

export const fetchProductMovements = async (
  productId: string,
  limit = 20,
  ownerId?: string
): Promise<InventoryMovementRow[]> => {
  let tenantId = ownerId;
  if (!tenantId) {
    const { data: authData } = await getAuthUserId();
    tenantId = authData.user?.id;
  }
  if (!tenantId) return [];
  await assertMerchantOwner(tenantId);

  const { data, error } = await inventoryMovementsTable()
    .select('id, quantity_delta, reason, created_at, order_id')
    .eq('product_id', productId)
    .eq('owner_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as InventoryMovementRow[];
};

export const fetchWarehouseStock = async (
  ownerId: string,
  warehouseId?: string
): Promise<Array<{ product_id: string; quantity: number; reserved_quantity: number; products?: { name: string } }>> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasWarehouseInventory())) return [];
  let query = warehouseStockTable()
    .select('product_id, quantity, reserved_quantity, products(name)')
    .eq('owner_id', ownerId);
  if (warehouseId) query = query.eq('warehouse_id', warehouseId);
  const { data, error } = await query.limit(200);
  if (error || !data) return [];
  return data as Array<{ product_id: string; quantity: number; reserved_quantity: number; products?: { name: string } }>;
};
