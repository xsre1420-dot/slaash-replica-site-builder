/**
 * Legacy products CRUD facade — queries vs commands.
 */
export {
  checkSupabaseConnection,
  listProducts,
  getProductById,
  type ProductsCrudResult,
  type ListProductsOptions,
} from '@/services/read/products/productQueryService';

export {
  createProduct,
  updateProduct,
  deleteProduct,
  bulkImportProducts,
  addProduct,
  publishProduct,
  setProductLifecycle,
  type BulkImportRow,
  type BulkImportResult,
} from '@/services/write/products/productCommandService';
