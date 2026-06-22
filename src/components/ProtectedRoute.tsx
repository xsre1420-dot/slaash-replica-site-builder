import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useStoreHydration } from '@/context/StoreBootstrapContext';
import { useSubscription } from '@/context/SubscriptionContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isReady, isHydrating } = useStoreHydration();
  const { hasAccess, isAdmin, loading: subLoading } = useSubscription();
  const location = useLocation();

  if (authLoading || subLoading || (user && !isReady && isHydrating)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm font-arabic">جارٍ تحميل بيانات متجرك...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const search = new URLSearchParams(location.search);
    const hasAuthCallback =
      search.has('code') ||
      location.hash.includes('access_token') ||
      location.hash.includes('error');
    if (hasAuthCallback) {
      return (
        <Navigate
          to={`/auth/callback${location.search}${location.hash}`}
          replace
        />
      );
    }
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!hasAccess && !isAdmin) {
    return (
      <Navigate
        to="/subscription-expired"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <>{children}</>;
};
