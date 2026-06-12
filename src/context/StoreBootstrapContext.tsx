import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { logger } from '@/lib/observability';
import { hydrateMerchantStore } from '@/services/merchantHydration';

interface StoreBootstrapContextValue {
  /** True after merchant data has been loaded from DB for current session */
  isReady: boolean;
  isHydrating: boolean;
  hydrationError: string | null;
  /** Increments on each successful hydration — use as effect dependency */
  hydrationVersion: number;
  refresh: () => Promise<void>;
}

const StoreBootstrapContext = createContext<StoreBootstrapContextValue>({
  isReady: false,
  isHydrating: false,
  hydrationError: null,
  hydrationVersion: 0,
  refresh: async () => {},
});

export const useStoreHydration = () => useContext(StoreBootstrapContext);

export const StoreBootstrapProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [hydrationVersion, setHydrationVersion] = useState(0);
  const hydratedForRef = useRef<string | null>(null);
  const inflightRef = useRef<Promise<void> | null>(null);

  const runHydration = useCallback(async (userId: string, force = false) => {
    if (!force && hydratedForRef.current === userId && inflightRef.current) {
      return inflightRef.current;
    }

    const task = (async () => {
      setIsHydrating(true);
      setHydrationError(null);
      setIsReady(false);

      try {
        await hydrateMerchantStore(userId);
        hydratedForRef.current = userId;
        setHydrationVersion((v) => v + 1);
        setIsReady(true);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'فشل تحميل بيانات المتجر';
        setHydrationError(message);
        logger.warn('merchant.hydrate.failed', { userId, error: e });
        // Still mark ready so pages can attempt their own DB fetch
        setIsReady(true);
      } finally {
        setIsHydrating(false);
        inflightRef.current = null;
      }
    })();

    inflightRef.current = task;
    return task;
  }, []);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    await runHydration(user.id, true);
  }, [user?.id, runHydration]);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      hydratedForRef.current = null;
      setIsReady(false);
      setIsHydrating(false);
      setHydrationError(null);
      return;
    }

    if (hydratedForRef.current === user.id && isReady) return;

    runHydration(user.id);
  }, [user?.id, authLoading, runHydration, isReady]);

  return (
    <StoreBootstrapContext.Provider
      value={{ isReady, isHydrating, hydrationError, hydrationVersion, refresh }}
    >
      {children}
    </StoreBootstrapContext.Provider>
  );
};
