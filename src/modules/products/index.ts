/** Products domain — public module API. */
export * from '@/services/productService';
export * from '@/services/productsCrudService';
export * as Read from '@/services/read/products/productQueryService';
export * as Write from '@/services/write/products/productCommandService';
export * as Repository from '@/repositories/products/productRepository';
