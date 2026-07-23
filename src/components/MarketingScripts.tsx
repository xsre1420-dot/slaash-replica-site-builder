import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchStoreMarketingConfig } from '@/services/marketingService';
import { captureMarketingAttribution } from '@/lib/attribution';
import {
  ensureMarketingTracking,
  resetMarketingTrackingInit,
  disableMarketingTracking,
  trackMetaPageView,
  isMarketingTrackingEnabled,
} from '@/lib/marketingTracking';

interface MarketingScriptsProps {
  storeSlug?: string | null;
  storeOwnerId?: string | null;
  /** Skip tracking on merchant preview routes to avoid polluting ad accounts */
  disabled?: boolean;
}

const MarketingScripts = ({ storeSlug, storeOwnerId, disabled }: MarketingScriptsProps) => {
  const location = useLocation();
  const initDoneRef = useRef(false);

  useEffect(() => {
    if (disabled) {
      disableMarketingTracking();
      initDoneRef.current = false;
      return;
    }

    captureMarketingAttribution(storeSlug);
    resetMarketingTrackingInit();
    initDoneRef.current = false;

    void ensureMarketingTracking({
      fetchConfig: () =>
        fetchStoreMarketingConfig({
          storeSlug: storeSlug || undefined,
          ownerId: storeOwnerId || undefined,
        }),
    }).then(() => {
      initDoneRef.current = true;
      trackMetaPageView(location.pathname + location.search);
    });

    return () => {
      resetMarketingTrackingInit();
      initDoneRef.current = false;
    };
  }, [storeSlug, storeOwnerId, disabled]);

  useEffect(() => {
    if (disabled || !initDoneRef.current || !isMarketingTrackingEnabled()) return;
    trackMetaPageView(location.pathname + location.search);
  }, [location.pathname, location.search, disabled]);

  return null;
};

export default MarketingScripts;
