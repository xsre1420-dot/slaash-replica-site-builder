import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  loadLoginPageBundle,
  peekLoginPageBundle,
  type LoginPageBundle,
} from '@/services/loginPageService';

export type LoginPageState = {
  ready: boolean;
  access: LoginPageBundle | null;
  refreshAccess: (options?: { force?: boolean }) => Promise<LoginPageBundle | null>;
};

export function useLoginPageBundle(): LoginPageState {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const [access, setAccess] = useState<LoginPageBundle | null>(() =>
    userId ? peekLoginPageBundle(userId) : null
  );
  const [ready, setReady] = useState(() => !authLoading && !userId);

  useEffect(() => {
    if (authLoading) {
      setReady(false);
      return;
    }
    if (!userId) {
      setAccess(null);
      setReady(true);
      return;
    }

    const cached = peekLoginPageBundle(userId);
    if (cached) {
      setAccess(cached);
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);

    void loadLoginPageBundle(userId).then((loaded) => {
      if (cancelled) return;
      setAccess(loaded);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

  const refreshAccess = useCallback(
    async (options?: { force?: boolean }) => {
      if (!userId) return null;
      const loaded = await loadLoginPageBundle(userId, options);
      setAccess(loaded);
      setReady(true);
      return loaded;
    },
    [userId]
  );

  return useMemo(
    () => ({
      ready,
      access,
      refreshAccess,
    }),
    [ready, access, refreshAccess]
  );
}
