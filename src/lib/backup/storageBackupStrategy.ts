/**
 * Phase 3 — Storage backup strategy (images, assets, documents, media).
 */
export type StorageAssetClass =
  | 'product_images'
  | 'store_assets'
  | 'documents'
  | 'media_uploads'
  | 'user_generated';

export type StorageBackupPolicy = {
  id: string;
  assetClass: StorageAssetClass;
  bucket: string;
  replication: 'same_region' | 'cross_region' | 'cdn_origin';
  schedule: string;
  retentionDays: number;
  versioning: boolean;
  description: string;
};

export const STORAGE_BACKUP_POLICIES: StorageBackupPolicy[] = [
  {
    id: 'storage-product-images',
    assetClass: 'product_images',
    bucket: 'product-images',
    replication: 'cross_region',
    schedule: '0 4 * * *',
    retentionDays: 365,
    versioning: true,
    description: 'Product catalog images — versioned bucket with cross-region replica',
  },
  {
    id: 'storage-store-assets',
    assetClass: 'store_assets',
    bucket: 'store-assets',
    replication: 'cross_region',
    schedule: '0 4 * * *',
    retentionDays: 365,
    versioning: true,
    description: 'Logos, banners, theme assets for merchant storefronts',
  },
  {
    id: 'storage-documents',
    assetClass: 'documents',
    bucket: 'documents',
    replication: 'same_region',
    schedule: '0 5 * * 0',
    retentionDays: 2555,
    versioning: true,
    description: 'Invoices, export CSVs, compliance documents — 7-year retention tier',
  },
  {
    id: 'storage-media',
    assetClass: 'media_uploads',
    bucket: 'media',
    replication: 'cdn_origin',
    schedule: '0 4 * * *',
    retentionDays: 180,
    versioning: true,
    description: 'General media uploads with CDN origin backup via object replication',
  },
  {
    id: 'storage-user-generated',
    assetClass: 'user_generated',
    bucket: 'user-uploads',
    replication: 'cross_region',
    schedule: '0 4 * * *',
    retentionDays: 90,
    versioning: true,
    description: 'Customer/merchant uploaded files — lifecycle aligned with account retention',
  },
];

export function getStorageBackupManifest(): {
  policies: StorageBackupPolicy[];
  assetClasses: StorageAssetClass[];
  verificationChecks: string[];
} {
  return {
    policies: STORAGE_BACKUP_POLICIES,
    assetClasses: [
      'product_images',
      'store_assets',
      'documents',
      'media_uploads',
      'user_generated',
    ],
    verificationChecks: [
      'Sample restore 10 random objects per bucket',
      'Verify Content-Type and ACL unchanged',
      'Compare checksum (ETag) source vs replica',
      'Confirm CDN cache invalidation after restore drill',
    ],
  };
}
