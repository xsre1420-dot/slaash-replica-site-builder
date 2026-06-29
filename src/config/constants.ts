/** Cross-domain application constants. */
export const APP_CONSTANTS = {
  pagination: {
    ordersPerPage: 50,
    defaultProductLimit: 50,
    maxProductLimit: 100,
  },
  cache: {
    storefrontBundleDefaultLimit: 24,
  },
  import: {
    inlineRowThreshold: 150,
    defaultBatchSize: 25,
    maxBatchLoop: 400,
  },
} as const;
