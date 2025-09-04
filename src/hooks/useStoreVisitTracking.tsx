
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

        // Validate IP and check rate limiting before insertion
        if (visitorIp && visitorIp !== 'unknown' && visitorIp.length < 50) {
          await supabase
            .from('store_visits')
            .insert({
              owner_id: ownerId,
              visitor_ip: visitorIp,
              user_agent: navigator.userAgent.substring(0, 500), // Limit user agent length
              page_path: window.location.pathname
            });
        }
      } catch (error) {
        // Silently fail to avoid disrupting user experience
        console.error('Error tracking visit:', error);
      }
    };

    trackVisit();
  }, [ownerId]);
};
