import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { setObservabilityRoute, logger, metrics } from '@/lib/observability';

const RouteObserver = () => {
  const location = useLocation();

  useEffect(() => {
    setObservabilityRoute(location.pathname);
    logger.info('navigation', { path: location.pathname, search: location.search });
    metrics.increment('page.view', { path: location.pathname });
  }, [location.pathname, location.search]);

  return null;
};

export default RouteObserver;
