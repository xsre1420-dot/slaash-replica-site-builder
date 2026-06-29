import { supabase, callSupabaseRpc } from '@/repositories/base';

export function productsTable() {
  return supabase.from('products');
}

export async function pingProductsTable() {
  return supabase.from('products').select('id').limit(1);
}

export async function rpcCreateMerchantProductWithStock(args: Record<string, unknown>) {
  return callSupabaseRpc('create_merchant_product_with_stock', args);
}

export async function rpcRecordProductInitialStock(args: Record<string, unknown>) {
  return callSupabaseRpc('record_product_initial_stock', args);
}

export async function rpcPatchMerchantProduct(args: Record<string, unknown>) {
  return (supabase as any).rpc('patch_merchant_product', args);
}

export async function rpcPublishOwnerProduct(args: Record<string, unknown>) {
  return callSupabaseRpc('publish_owner_product', args);
}

export async function rpcRecordInitialStockMovements(args: Record<string, unknown>) {
  return callSupabaseRpc('record_initial_stock_movements', args);
}

export async function rpcLookupProductIdempotency(args: Record<string, unknown>) {
  return callSupabaseRpc<string>('lookup_product_idempotency', args);
}

export async function rpcRecordProductIdempotency(args: Record<string, unknown>) {
  return callSupabaseRpc('record_product_idempotency', args);
}
