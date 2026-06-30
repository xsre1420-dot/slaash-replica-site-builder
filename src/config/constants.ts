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
    defaultBatchSize: 50,
    maxBatchLoop: 400,
    maxBatchSize: 50,
  },
  largeDataset: {
    keysetPaginationRecommendedAbovePage: 20,
    deepOffsetThreshold: 1000,
    statsCapRows: 5000,
  },
} as const;
