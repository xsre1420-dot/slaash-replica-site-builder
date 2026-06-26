/**
 * Inventory audit and movement history — read-only.
 */
import { supabase } from '@/integrations/supabase/client';
import { assertMerchantOwner } from '@/lib/tenantGuard';

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

  const { data, error } = await (supabase as any).rpc('audit_merchant_inventory_integrity', {
    p_owner_id: ownerId,
  });

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

export const fetchProductMovements = async (
  productId: string,
  limit = 20,
  ownerId?: string
): Promise<InventoryMovementRow[]> => {
  let tenantId = ownerId;
  if (!tenantId) {
    const { data: authData } = await supabase.auth.getUser();
    tenantId = authData.user?.id;
  }
  if (!tenantId) return [];
  await assertMerchantOwner(tenantId);

  const { data, error } = await (supabase as any)
    .from('inventory_movements')
    .select('id, quantity_delta, reason, created_at')
    .eq('product_id', productId)
    .eq('owner_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as InventoryMovementRow[];
};
