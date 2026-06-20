import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchMerchantAccess, type MerchantAccessState } from '@/services/subscriptionService';

type SubscriptionContextValue = MerchantAccessState & {
  refresh: () => Promise<void>;
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

  const refresh = async () => {
    if (!user) {
      setState({ loading: false, isAdmin: false, hasAccess: false, subscription: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const next = await fetchMerchantAccess();
    setState(next);
  };

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [user?.id, authLoading]);

  return (
    <SubscriptionContext.Provider value={{ ...state, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
};
