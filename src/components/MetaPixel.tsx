import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface MetaPixelProps {
  event?: 'ViewContent' | 'AddToCart' | 'Purchase' | 'CompleteRegistration';
  data?: {
    content_ids?: string[];
    content_type?: string;
    value?: number;
    currency?: string;
    content_name?: string;
  };
}

declare global {
  interface Window {
    fbq: any;
  }
}

const MetaPixel = ({ event, data }: MetaPixelProps) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const loadPixelSettings = async () => {
      const { data: settings } = await supabase
        .from('marketing_settings')
        .select('meta_pixel_id')
        .eq('owner_id', user.id)
        .single();

      if (!settings?.meta_pixel_id) return;

      // Initialize Meta Pixel if not already loaded
      if (!window.fbq) {
        const script = document.createElement('script');
        script.innerHTML = `
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
        `;
        document.head.appendChild(script);

        // Initialize pixel
        window.fbq('init', settings.meta_pixel_id);
        window.fbq('track', 'PageView');

        // Add noscript fallback
        const noscript = document.createElement('noscript');
        noscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${settings.meta_pixel_id}&ev=PageView&noscript=1" />`;
        document.body.appendChild(noscript);
      }

      // Track specific events if provided
      if (event && window.fbq) {
        if (data) {
          window.fbq('track', event, data);
        } else {
          window.fbq('track', event);
        }
      }
    };

    loadPixelSettings();
  }, [user, event, data]);

  return null;
};

export default MetaPixel;