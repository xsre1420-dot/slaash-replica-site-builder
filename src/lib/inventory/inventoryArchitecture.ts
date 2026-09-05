/**
 * Simple inventory model — production architecture for Bidaya.
 *
 * Active in production:
 * - products.stock_quantity + variants JSON
 * - increment_product_stock / batch_restock_products
 * - merchant_inventory_summary / list_merchant_inventory_movements
 * - audit_merchant_inventory_integrity
 * - checkout stock deduction via create_order_with_stock_deduction
 *
 * Deferred (premium-inventory wave):
 * - warehouses, warehouse_stock, purchase_orders, suppliers, cycle counts
 * - get_merchant_inventory_page_bundle (phase 3.5)
 * - barcode lookup, warehouse transfers
 */
export const INVENTORY_MODEL = 'simple' as const;

export type InventoryModel = typeof INVENTORY_MODEL | 'warehouse';
