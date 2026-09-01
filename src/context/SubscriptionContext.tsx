import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchMerchantAccess,
  peekMerchantAccess,
  type MerchantAccessState,
} from '@/services/subscriptionService';

type SubscriptionContextValue = MerchantAccessState & {
  refresh: () => Promise<MerchantAccessState | void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<MerchantAccessState>({
    loading: true,
    isAdmin: false,
    hasAccess: false,
    subscription: null,
  });

  const refresh = useCallback(async (options?: { force?: boolean }) => {
    if (!user) {
      setState({ loading: false, isAdmin: false, hasAccess: false, subscription: null });
      return;
    }
    if (!options?.force) {
      const cached = peekMerchantAccess(user.id);
      if (cached) {
        setState(cached);
        return cached;
      }
    }
    setState((s) => ({ ...s, loading: true }));
    const next = await fetchMerchantAccess({ userId: user.id, force: options?.force });
    setState(next);
    return next;
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ loading: false, isAdmin: false, hasAccess: false, subscription: null });
      return;
    }
    const cached = peekMerchantAccess(user.id);
    if (cached) {
      setState(cached);
      return;
    }
    void refresh();
  }, [user?.id, authLoading, refresh]);

  const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
};
