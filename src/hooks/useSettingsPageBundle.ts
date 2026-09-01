import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStoreHydration } from '@/context/StoreBootstrapContext';
import type { CustomDomainSettings } from '@/services/storeService';
import {
  loadSettingsPageBundle,
  loadSettingsDomainBundle,
  peekSettingsPageBundle,
  invalidateSettingsPageBundle,
  type SettingsPageBundle,
} from '@/services/settingsPageService';

export type SettingsPageState = {
  loading: boolean;
  bundle: SettingsPageBundle | null;
  domainLoading: boolean;
  domain: CustomDomainSettings | null;
  refetch: () => Promise<SettingsPageBundle | null>;
  loadDomain: () => Promise<CustomDomainSettings | null>;
};

export function useSettingsPageBundle(): SettingsPageState {
  const { user } = useAuth();
  const { isReady, hydrationVersion } = useStoreHydration();
  const ownerId = user?.id;

  const [bundle, setBundle] = useState<SettingsPageBundle | null>(() =>
    ownerId ? peekSettingsPageBundle(ownerId) : null
  );
  const [loading, setLoading] = useState(() => !bundle && !!ownerId);
  const [domain, setDomain] = useState<CustomDomainSettings | null>(null);
  const [domainLoading, setDomainLoading] = useState(false);

  useEffect(() => {
    if (!ownerId) {
      setLoading(false);
      return;
    }
    if (!isReady) {
      setLoading(true);
      return;
    }

    const cached = peekSettingsPageBundle(ownerId);
    if (cached) {
      setBundle(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void loadSettingsPageBundle(ownerId).then((loaded) => {
      if (cancelled) return;
      setBundle(loaded);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isReady, hydrationVersion, ownerId]);

  const refetch = useCallback(async () => {
    if (!ownerId) return null;
    setLoading(true);
    try {
      const loaded = await loadSettingsPageBundle(ownerId, { force: true });
      setBundle(loaded);
      return loaded;
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  const loadDomain = useCallback(async (options?: { force?: boolean }) => {
    if (!ownerId) return null;
    setDomainLoading(true);
    try {
      const loaded = await loadSettingsDomainBundle(ownerId, options);
      setDomain(loaded);
      return loaded;
    } finally {
      setDomainLoading(false);
    }
  }, [ownerId]);

  return useMemo(
    () => ({
      loading,
      bundle,
      domainLoading,
      domain,
      refetch,
      loadDomain,
    }),
    [loading, bundle, domainLoading, domain, refetch, loadDomain]
  );
}

export { invalidateSettingsPageBundle, settingsFormFromBundle } from '@/services/settingsPageService';
export type { SettingsPageBundle, SettingsFormSnapshot } from '@/services/settingsPageService';
