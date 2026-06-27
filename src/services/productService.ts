/**
 * Merchant product & category layer — canonical import for catalog operations.
 *
 * Writes: productsCrudService (Supabase CRUD, publish, lifecycle)
 * Reads/cache: merchantProductCatalogService (pagination, categories, storefront sync)
 */
export {
  checkSupabaseConnection,
  listProducts,
  getProductById as getProductByIdFromDb,
  createProduct,
  addProduct,
  updateProduct,
  deleteProduct,
  publishProduct,
  setProductLifecycle,
  bulkImportProducts,
  type ProductsCrudResult,
  type ListProductsOptions,
  type BulkImportRow,
  type BulkImportResult,
} from '@/services/productsCrudService';

export {
  setCurrentOwner,
  setCurrentStore,
  getCurrentStoreId,
  getCategories,
  getCategoriesSync,
  PRODUCTS_PAGE_SIZE,
  loadProductsPage,
  getProductsSync,
  products,
  invalidateCache,
  invalidateOwnerCache,
  invalidateProducts,
  invalidateCategories,
  appendCachedProduct,
  patchCachedProduct,
  removeCachedProduct,
  syncMerchantProductCatalog,
  patchMerchantStockInCache,
  getProductById,
  fetchProductById,
  addCategory,
  updateCategory,
  deleteCategory,
  type ProductsPageResult,
} from '@/services/merchantProductCatalogService';

/** @deprecated Use updateProduct */
export { updateProduct as updateProductInDb } from '@/services/productsCrudService';

/** @deprecated Use deleteProduct */
export { deleteProduct as deleteProductFromDb } from '@/services/productsCrudService';
