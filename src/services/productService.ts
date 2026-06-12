/**
 * Canonical product & category data layer.
 * @deprecated Import from here instead of `@/data/dummyData` in new code.
 */
export {
  setCurrentOwner,
  getCategories,
  getCategoriesSync,
  PRODUCTS_PAGE_SIZE,
  loadProductsPage,
  loadProducts,
  getProductsSync,
  products,
  reloadProducts,
  invalidateCache,
  invalidateProducts,
  invalidateCategories,
  appendCachedProduct,
  patchCachedProduct,
  removeCachedProduct,
  addProduct,
  updateProduct,
  deleteProduct,
  getProductsByCategory,
  getProductById,
  addCategory,
  updateCategory,
  deleteCategory,
  type ProductsPageResult,
} from '@/data/dummyData';
