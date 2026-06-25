import { Outlet, useParams } from 'react-router-dom';
import { TenantStoreProvider } from '@/context/TenantStoreContext';

/** Shares one tenant-meta fetch across Store / ProductDetails / Checkout on the same slug. */
const StorefrontRouteShell = () => {
  const { username = '' } = useParams<{ username: string }>();
  return (
    <TenantStoreProvider slug={username}>
      <Outlet />
    </TenantStoreProvider>
  );
};

export default StorefrontRouteShell;
