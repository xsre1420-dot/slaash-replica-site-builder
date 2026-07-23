import { supabase, callWriteRpc, callReadRpc } from '@/repositories/base';

export function productsTable() {
  return supabase.from('products');
}

export async function pingProductsTable() {
  return supabase.from('products').select('id').limit(1);
}

export async function rpcCreateMerchantProductWithStock(args: Record<string, unknown>) {
  return callWriteRpc<{ success?: boolean; product_id?: string; error?: string; detail?: string }>(
    'create_merchant_product_with_stock',
    args
  );
}

export async function rpcRecordProductInitialStock(args: Record<string, unknown>) {
  return callWriteRpc('record_product_initial_stock', args);
}

export async function rpcPatchMerchantProduct(args: Record<string, unknown>) {
  return callWriteRpc('patch_merchant_product', args);
}

export async function rpcPublishOwnerProduct(args: Record<string, unknown>) {
  return callWriteRpc('publish_owner_product', args);
}

export async function rpcRecordInitialStockMovements(args: Record<string, unknown>) {
  return callWriteRpc('record_initial_stock_movements', args);
}

export async function rpcLookupProductIdempotency(args: Record<string, unknown>) {
  return callReadRpc<string>('lookup_product_idempotency', args);
}

export async function rpcRecordProductIdempotency(args: Record<string, unknown>) {
  return callWriteRpc('record_product_idempotency', args);
}
