
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export const useStoreVisitTracking = (ownerId?: string) => {
  const { user } = useAuth();

  useEffect(() => {
    const trackVisit = async () => {
      // Only track visits to store pages, not admin pages
      if (!ownerId || window.location.pathname.includes('/builder') || window.location.pathname.includes('/login')) {
        return;
      }

      try {
        const visitorIp = await fetch('https://api.ipify.org?format=json')
          .then(res => res.json())
          .then(data => data.ip)
          .catch(() => 'unknown');

        await supabase
          .from('store_visits')
          .insert({
            owner_id: ownerId,
            visitor_ip: visitorIp,
            user_agent: navigator.userAgent,
            page_path: window.location.pathname
          });
      } catch (error) {
        console.error('Error tracking visit:', error);
      }
    };

    trackVisit();
  }, [ownerId]);
};
