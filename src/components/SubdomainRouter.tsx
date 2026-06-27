import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { parseStoreSlugFromHostname } from '@/lib/tenant/subdomain';

/**
 * Redirects subdomain requests to /store/:slug paths.
 * Example: mystore.platform.com → /store/mystore
 */
const SubdomainRouter = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const slug = parseStoreSlugFromHostname(window.location.hostname);
    if (!slug) return;

    const path = location.pathname;
    if (path.startsWith('/store/')) return;

    if (path === '/' || path === '') {
      navigate(`/store/${slug}`, { replace: true });
      return;
    }

    if (path.startsWith('/product/') || path.startsWith('/checkout')) {
      const suffix = path.startsWith('/checkout') ? '/checkout' : path.replace('/product/', '/product/');
      navigate(`/store/${slug}${suffix}`, { replace: true });
    }
  }, [location.pathname, navigate]);

  return null;
};

export default SubdomainRouter;
