import { useEffect } from 'react';
import { fetchStoreMarketingConfig } from '@/services/marketingService';
import { captureMarketingAttribution } from '@/lib/attribution';
import { ensureMarketingTracking, resetMarketingTrackingInit, disableMarketingTracking } from '@/lib/marketingTracking';

interface MarketingScriptsProps {
  storeSlug?: string | null;
  storeOwnerId?: string | null;
  /** Skip tracking on merchant preview routes to avoid polluting ad accounts */
  disabled?: boolean;
}

const MarketingScripts = ({ storeSlug, storeOwnerId, disabled }: MarketingScriptsProps) => {
  useEffect(() => {
    if (disabled) {
      disableMarketingTracking();
      return;
    }

    captureMarketingAttribution(storeSlug);
    resetMarketingTrackingInit();

    void ensureMarketingTracking({
      fetchConfig: () =>
        fetchStoreMarketingConfig({
          storeSlug: storeSlug || undefined,
          ownerId: storeOwnerId || undefined,
        }),
    });
  }, [storeSlug, storeOwnerId, disabled]);

  return null;
};

export default MarketingScripts;
