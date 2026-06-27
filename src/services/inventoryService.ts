/**
 * Legacy inventory service facade.
 */
export {
  InventoryRestockError,
  auditInventoryIntegrity,
  fetchProductMovements,
  type InventoryMovementRow,
  type InventoryIntegritySummary,
  type InventoryIntegrityResult,
} from '@/services/read/inventory/inventoryReadService';

export { restockProduct, applyStockQuantityPatch } from '@/services/write/inventory/inventoryWriteService';
