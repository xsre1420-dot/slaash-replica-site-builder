# Runtime data

Merchant catalog data lives in Supabase. Use `@/services/productService` (facade) or directly:

- **Writes:** `@/services/productsCrudService`
- **Reads / cache:** `@/services/merchantProductCatalogService`
- **Inventory:** `@/services/inventoryService`
- **Storefront:** `@/services/storefrontProductService`

Do not add runtime data layers in this folder.
