/**
 * Canonical product & category data layer.
 * @deprecated Import from here instead of `@/data/dummyData` in new code.
 */
export {
  checkSupabaseConnection,
  listProducts,
  getProductById as getProductByIdFromDb,
  createProduct,
  updateProduct as updateProductInDb,
  deleteProduct as deleteProductFromDb,
  type ProductsCrudResult,
  type ListProductsOptions,
} from '@/services/productsCrudService';

export {
  setCurrentOwner,
  setCurrentStore,
  getCurrentStoreId,
  getCategories,
  getCategoriesSync,
  PRODUCTS_PAGE_SIZE,
  loadProductsPage,
  loadProducts,
  loadAllMerchantProducts,
  getProductsSync,
  products,
  reloadProducts,
  invalidateCache,
  invalidateOwnerCache,
  invalidateProducts,
  invalidateCategories,
  appendCachedProduct,
  patchCachedProduct,
  removeCachedProduct,
  syncMerchantProductCatalog,
  addProduct,
  updateProduct,
  setProductLifecycle,
  publishProduct,
  deleteProduct,
  getProductsByCategory,
  getProductById,
  fetchProductById,
  addCategory,
  updateCategory,
  deleteCategory,
  type ProductsPageResult,
} from '@/data/dummyData';
